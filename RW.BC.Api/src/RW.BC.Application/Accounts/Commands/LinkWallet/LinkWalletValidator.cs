using FluentValidation;

namespace RW.BC.Application.Accounts.Commands.LinkWallet;

public sealed class LinkWalletValidator : AbstractValidator<LinkWalletCommand>
{
    public LinkWalletValidator()
    {
        RuleFor(c => c.Address)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("{PropertyName} cannot be null or empty.")
            .Matches("^0x[0-9a-fA-F]{40}$")
            .WithMessage("{PropertyName} must be a valid EVM wallet address.");

        RuleFor(c => c.Signature)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("{PropertyName} cannot be null or empty.")
            .Matches("^0x[0-9a-fA-F]{130}$")
            .WithMessage("{PropertyName} must be a valid EVM signature (65-byte hex).");
    }
}
