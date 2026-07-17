using Gridify;

namespace RW.BC.Application.Transparency.Queries.GetSales;

public sealed class SaleGridifyMapper : GridifyMapper<SaleRow>
{
    public SaleGridifyMapper()
    {
        AddMap("seller", r => r.Seller);
        AddMap("buyer", r => r.Buyer);
        AddMap("tokenId", r => r.TokenId);
        AddMap("blockNumber", r => r.BlockNumber);
    }
}
