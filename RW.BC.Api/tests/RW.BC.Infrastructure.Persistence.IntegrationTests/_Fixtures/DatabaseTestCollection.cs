namespace RW.BC.Infrastructure.Persistence.IntegrationTests._Fixtures;

[CollectionDefinition("Database")]
public sealed class DatabaseTestCollection : ICollectionFixture<PostgreSqlFixture>;
