using System.Numerics;
using RW.BC.Application.Referral.Ports;
using RW.BC.Application.Referral.Queries.GetReferralInfo;

namespace RW.BC.Application.UnitTests.Referral.Queries;

public sealed class GetReferralInfoHandlerTests
{
    private readonly Mock<IReferralQueryService> _store = new(MockBehavior.Strict);

    private GetReferralInfoHandler Sut() => new(_store.Object);

    private const string Address = "0xAbCd000000000000000000000000000000000001";
    private const string NormalizedAddress = "0xabcd000000000000000000000000000000000001";

    [Fact]
    public async Task Handle_ShouldNormalizeAddress_ToLowercase()
    {
        SetupStore(NormalizedAddress, code: "42", upline: null, count: 0, accrued: "0", claimed: "0");

        await Sut().Handle(new GetReferralInfoQuery(Address), CancellationToken.None);

        _store.Verify(s => s.GetRegistrationCodeAsync(NormalizedAddress, It.IsAny<CancellationToken>()), Times.Once);
        _store.Verify(s => s.GetUplineAsync(NormalizedAddress, It.IsAny<CancellationToken>()), Times.Once);
        _store.Verify(s => s.GetReferralCountAsync(NormalizedAddress, It.IsAny<CancellationToken>()), Times.Once);
        _store.Verify(s => s.GetTotalAccruedAsync(NormalizedAddress, It.IsAny<CancellationToken>()), Times.Once);
        _store.Verify(s => s.GetTotalClaimedAsync(NormalizedAddress, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldReturnNullCodeAndUpline_WhenAddressIsUnknown()
    {
        SetupStore(NormalizedAddress, code: null, upline: null, count: 0, accrued: "0", claimed: "0");

        var result = await Sut().Handle(new GetReferralInfoQuery(NormalizedAddress), CancellationToken.None);

        result.Code.Should().BeNull();
        result.Upline.Should().BeNull();
        result.ReferralCount.Should().Be(0);
        result.Pending.Should().Be("0");
        result.TotalAccrued.Should().Be("0");
        result.TotalClaimed.Should().Be("0");
    }

    [Fact]
    public async Task Handle_ShouldReturnCorrectReferralInfo_WhenDataExists()
    {
        SetupStore(NormalizedAddress, code: "99", upline: "0xupline", count: 3, accrued: "1000", claimed: "400");

        var result = await Sut().Handle(new GetReferralInfoQuery(NormalizedAddress), CancellationToken.None);

        result.Code.Should().Be("99");
        result.Upline.Should().Be("0xupline");
        result.ReferralCount.Should().Be(3);
        result.TotalAccrued.Should().Be("1000");
        result.TotalClaimed.Should().Be("400");
        result.Pending.Should().Be("600");
    }

    [Fact]
    public async Task Handle_ShouldDerivePending_AsAccruedMinusClaimed()
    {
        var accrued = BigInteger.Pow(2, 200);
        var claimed = BigInteger.Pow(2, 100);
        var expectedPending = accrued - claimed;

        SetupStore(NormalizedAddress, code: null, upline: null, count: 0,
            accrued: accrued.ToString(), claimed: claimed.ToString());

        var result = await Sut().Handle(new GetReferralInfoQuery(NormalizedAddress), CancellationToken.None);

        result.Pending.Should().Be(expectedPending.ToString(),
            "pending must be accrued minus claimed without overflow for uint256-range values");
        result.TotalAccrued.Should().Be(accrued.ToString());
        result.TotalClaimed.Should().Be(claimed.ToString());
    }

    [Fact]
    public async Task Handle_ShouldReturnZeroPending_WhenAccruedEqualsZero()
    {
        SetupStore(NormalizedAddress, code: null, upline: null, count: 0, accrued: "0", claimed: "0");

        var result = await Sut().Handle(new GetReferralInfoQuery(NormalizedAddress), CancellationToken.None);

        result.Pending.Should().Be("0");
    }

    private void SetupStore(string addr, string? code, string? upline, long count, string accrued, string claimed)
    {
        _store.Setup(s => s.GetRegistrationCodeAsync(addr, It.IsAny<CancellationToken>()))
            .ReturnsAsync(code);
        _store.Setup(s => s.GetUplineAsync(addr, It.IsAny<CancellationToken>()))
            .ReturnsAsync(upline);
        _store.Setup(s => s.GetReferralCountAsync(addr, It.IsAny<CancellationToken>()))
            .ReturnsAsync(count);
        _store.Setup(s => s.GetTotalAccruedAsync(addr, It.IsAny<CancellationToken>()))
            .ReturnsAsync(accrued);
        _store.Setup(s => s.GetTotalClaimedAsync(addr, It.IsAny<CancellationToken>()))
            .ReturnsAsync(claimed);
    }
}
