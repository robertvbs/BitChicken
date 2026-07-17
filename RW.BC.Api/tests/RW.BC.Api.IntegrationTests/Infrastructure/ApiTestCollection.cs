using Xunit;

namespace RW.BC.Api.IntegrationTests.Infrastructure;

[CollectionDefinition("Api")]
public sealed class ApiTestCollection : ICollectionFixture<ApiWebApplicationFactory>;
