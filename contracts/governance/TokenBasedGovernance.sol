// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// TokenQuorumGovernance is extending Governance class with standard 1 token = 1 VP

import "./Governance.sol";

contract TokenBasedGovernance is Governance {
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
    ) public override initializer {
        Governance.initialize(
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
        uint256 amount
    ) public membersOnly returns (uint256) {
        require(
            !hasVoted(proposalId, msg.sender),
            "TokenQuorumGovernance: you can vote only once"
        );
        require(
            state(proposalId) == ProposalState.Active,
            "TokenQuorumGovernance: voting is closed"
        );

        uint256 nWeight = getVotes(msg.sender, proposalSnapshot(proposalId));
        console.log("nWeight: %s", nWeight);
        uint256 voteWeight = amount;
        require(
            voteWeight <= nWeight,
            "TokenQuorumGovernance: You need at least as many tokens as you want to vote with."
        );
        proposals[proposalId].votes = SafeMathUpgradeable.add(
            proposals[proposalId].votes,
            amount
        );
        proposals[proposalId].budget = SafeMathUpgradeable.add(
            proposals[proposalId].budget,
            voteWeight
        );

        _countVote(proposalId, msg.sender, support, voteWeight, "");
        proposals[proposalId].lastUpdateTime[msg.sender] = block.timestamp;
        proposals[proposalId].votesByMember[msg.sender] = voteWeight;
        SafeERC20Upgradeable.safeTransferFrom(
            IERC20Upgradeable(tokenAddress),
            msg.sender,
            address(this),
            voteWeight
        );
        emit VoteCast(msg.sender, proposalId, support, voteWeight, "");
        return voteWeight;
    }

    function castVote(
        uint256 proposalId,
        uint8 support
    ) public override membersOnly returns (uint256) {
        return castVote(proposalId, support, 1);
    }
}
