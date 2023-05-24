// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Quadratic Governance is extending Governance class with quadratic voting
// and quadratic budgeting
import "./Governance.sol";

contract QuadraticGovernance is Governance {
    uint256 _minQuadraticVoteThreshold;

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
        _minQuadraticVoteThreshold = 1;
    }

    function minQuadraticVoteThreshold() public view returns (uint256) {
        return _minQuadraticVoteThreshold;
    }

    function setMinQuadraticVoteThreshold(
        uint256 amount
    ) public organizationOnly {
        _minQuadraticVoteThreshold = amount;
    }

    function castVote(
        uint256 proposalId,
        uint8 support,
        uint256 amount,
        string memory reason
    ) public payable membersOnly returns (uint256) {
        require(
            state(proposalId) == ProposalState.Active,
            "QuadraticGovernance: voting is closed"
        );
        require(
            !hasVoted(proposalId, msg.sender),
            "OrganizationGovernance: you can vote only once in a voting period"
        );
        require(
            amount >= _minQuadraticVoteThreshold,
            "QuadraticGovernance: amount is too small"
        );

        uint256 nWeight = getVotes(msg.sender, proposalSnapshot(proposalId));
        uint256 voteWeight = SafeMathUpgradeable.mul(amount, amount);
        uint256 fee;
        if (amount == 1) {
            fee = 0;
        } else {
            fee = SafeMathUpgradeable.mul(voteWeight, 0.0001 ether);
        }
        require(
            voteWeight <= nWeight,
            "QuadraticGovernance: You need at least as many tokens as you want to vote with."
        );
        require(
            fee <= msg.value,
            "QuadraticGovernance: amount sent does not cover fee"
        );

        proposals[proposalId].votes = SafeMathUpgradeable.add(
            proposals[proposalId].votes,
            amount
        );
        proposals[proposalId].budget = SafeMathUpgradeable.add(
            proposals[proposalId].budget,
            msg.value
        );

        _countVote(proposalId, msg.sender, support, voteWeight, "");
        proposals[proposalId].voters.push(msg.sender);
        proposals[proposalId].votesByMember[msg.sender] = amount;
        emit VoteCast(msg.sender, proposalId, support, amount, reason);
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
