var builder = DistributedApplication.CreateBuilder(args);

var postgres = builder.AddPostgres("postgres-server")
    .WithImageTag("17.6")
    .WithDataVolume("bitchicken-pg-data")
    .WithLifetime(ContainerLifetime.Persistent)
    .WithPgAdmin(pgAdmin => pgAdmin.WithHostPort(5050));

var bitchickenDb = postgres.AddDatabase("bitchicken");

builder.AddProject<Projects.RW_BC_Api>("api")
    .WithReference(bitchickenDb)
    .WaitFor(bitchickenDb);

var cryptoDir = Path.Combine(builder.AppHostDirectory, "..", "RW.BC.Crypto");
var dappDir = Path.Combine(builder.AppHostDirectory, "..", "RW.BC.DApp");
var indexerDir = Path.Combine(builder.AppHostDirectory, "..", "RW.BC.Indexer");
var deployedAddressesPath = Path.GetFullPath(Path.Combine(cryptoDir, "scripts", "deployed-localhost.json"));

void UseNode(IResourceBuilder<NodeAppResource> resource)
{
    var nodeBin = ResolveNodeBin();
    if (nodeBin is null)
    {
        return;
    }

    resource.WithEnvironment(context =>
    {
        var current = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
        context.EnvironmentVariables["PATH"] = $"{nodeBin}{Path.PathSeparator}{current}";
    });
}

var localnet = builder.AddContainer("localnet", "ghcr.io/foundry-rs/foundry", "latest")
    .WithEntrypoint("anvil")
    .WithArgs(
        "--host", "0.0.0.0",
        "--chain-id", "1337",
        "--block-time", "1",
        "--hardfork", "cancun",
        "--mnemonic", "test test test test test test test test test test test junk",
        "--accounts", "10",
        "--balance", "10000")
    .WithLifetime(ContainerLifetime.Session)
    .WithEndpoint(port: 8545, targetPort: 8545, scheme: "http", name: "rpc", isProxied: false);

builder.AddContainer("explorer", "otterscan/otterscan", "latest")
    .WithHttpEndpoint(port: 5100, targetPort: 80, name: "http", isProxied: false)
    .WithEnvironment("ERIGON_URL", "http://localhost:8545")
    .WaitFor(localnet);

var deploy = builder.AddNpmApp("deploy", cryptoDir, "deploy:localhost")
    .WaitFor(localnet);
UseNode(deploy);

var fund = builder.AddNpmApp("fund", cryptoDir, "fund:localhost")
    .WaitForCompletion(deploy);
UseNode(fund);

var forgeWatch = builder.AddNpmApp("forge-watch", cryptoDir, "forge:watch")
    .WaitForCompletion(fund);
UseNode(forgeWatch);

var indexerReset = builder.AddNpmApp("indexer-reset", indexerDir, "reset-schema")
    .WithReference(bitchickenDb)
    .WithEnvironment("DATABASE_SCHEMA", "indexer")
    .WaitFor(bitchickenDb);
UseNode(indexerReset);

var indexer = builder.AddNpmApp("indexer", indexerDir, "start")
    .WithReference(bitchickenDb)
    .WithEnvironment("DATABASE_SCHEMA", "indexer")
    .WithEnvironment("CHAIN_ID", "1337")
    .WithEnvironment("PONDER_RPC_URL_1337", "http://localhost:8545")
    .WithEnvironment("DEPLOYED_ADDRESSES_PATH", deployedAddressesPath)
    .WithEnvironment("MARKETPLACE_START_BLOCK", "0")
    .WaitFor(bitchickenDb)
    .WaitForCompletion(indexerReset)
    .WaitForCompletion(deploy);
UseNode(indexer);

var dapp = builder.AddNpmApp("dapp", dappDir, "start:local")
    .WithHttpEndpoint(port: 4200, targetPort: 4200, isProxied: false)
    .WithExternalHttpEndpoints()
    .WaitFor(localnet);
UseNode(dapp);

builder.Build().Run();

static string? ResolveNodeBin()
{
    var home = Environment.GetEnvironmentVariable("HOME")
               ?? Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
    if (string.IsNullOrEmpty(home))
    {
        return null;
    }

    var nvmNodeDir = Path.Combine(home, ".nvm", "versions", "node");
    if (!Directory.Exists(nvmNodeDir))
    {
        return null;
    }

    var newest = Directory.EnumerateDirectories(nvmNodeDir, "v*")
        .Select(path => (path, version: ParseNodeVersion(Path.GetFileName(path))))
        .Where(entry => entry.version is { Major: >= 22 })
        .OrderByDescending(entry => entry.version)
        .Select(entry => entry.path)
        .FirstOrDefault();

    if (newest is null)
    {
        return null;
    }

    var bin = Path.Combine(newest, "bin");
    return Directory.Exists(bin) ? bin : null;
}

static Version? ParseNodeVersion(string folderName)
    => Version.TryParse(folderName.TrimStart('v'), out var version) ? version : null;
