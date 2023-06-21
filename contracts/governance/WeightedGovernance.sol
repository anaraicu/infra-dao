// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// WeightedGovernance is extending TokenBasedGovernance class with standard 1 token = 1 VP
import "./TokenBasedGovernance.sol";

contract WeightedGovernance is TokenBasedGovernance {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        IVotesUpgradeable _token,
        IERC1155Upgradeable membershipToken,
        TimelockControllerUpgradeable _timelock,
        uint256 _votingPeriod,
        uint256 _quorumPercentage,
        uint256 _proposalThreshold,
        address _organizationAddress
    ) public override {
        TokenBasedGovernance.initialize(
            _token,
            membershipToken,
            _timelock,
            _votingPeriod,
            _quorumPercentage,
            _proposalThreshold,
            _organizationAddress
        );
    }

    function castVote(
        uint256 proposalId,
        uint8 support,
        uint256 amount,
        string memory reason
    ) public payable membersOnly returns (uint256) {
        require(
            !hasVoted(proposalId, msg.sender),
            "WeightedGovernance::castVote: you can vote only once"
        );
        require(
            state(proposalId) == ProposalState.Active,
            "WeightedGovernance::castVote: voting is closed"
        );

        uint256 nWeight = getVotes(msg.sender, proposalSnapshot(proposalId));
        uint256 voteWeight = amount;
        uint256 fee;
        if (amount == 1) {
            fee = 0; // free vote
        } else {
            fee = voteWeight * (0.0001 ether);
        }
        require(
            voteWeight <= nWeight,
            "WeightedGovernance::castVote: You need at least as many tokens as you want to vote with."
        );
        require(
            msg.value >= fee,
            "WeightedGovernance::castVote: You need to pay the fee for casting more VP."
        );
        proposals[proposalId].votes = proposals[proposalId].votes + amount;
        proposals[proposalId].budget = proposals[proposalId].budget + msg.value;

        _countVote(proposalId, msg.sender, support, voteWeight, "");
        proposals[proposalId].voters.push(msg.sender);
        proposals[proposalId].votesByMember[msg.sender] = voteWeight;
        emit VoteCast(msg.sender, proposalId, support, voteWeight, reason);
        return voteWeight;
    }

    function castVote(
        uint256 proposalId,
        uint8 support,
        string memory reason
    ) public payable override membersOnly returns (uint256) {
        return castVote(proposalId, support, 1, reason);
    }

    function castVote(
        uint256 proposalId,
        uint8 support
    ) public override membersOnly returns (uint256) {
        return castVote(proposalId, support, 1, "");
    }
}
