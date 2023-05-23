// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// MultiSigGovernance is extending Governance class with MultiSignature voting
import "./Governance.sol";

contract MultiSigGovernance is Governance {
    address[] _signers;
    uint256 _requiredSignatures;

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
        _requiredSignatures = 4;
    }

    function requiredSignatures() public view returns (uint256) {
        return _requiredSignatures;
    }

    function setRequiredSignatures(
        uint256 amount
    ) public organizationOnly {
        _requiredSignatures = amount;
    }

    function _execute(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override {
        uint256 signs = 0;
        uint256 signersLength = _signers.length;
        ///
        for (uint256 i = 0; i < signersLength; i++) {
            if (hasVoted(proposalId, _signers[uint256(i)])) {
                signs++;
            }
            if (signs >= _requiredSignatures) {
                break;
            }
        }
        require(
            signs >= _requiredSignatures || signs == signersLength,
            "MultiSigGovernance: not enough signatures"
        );
        super._execute(proposalId, targets, values, calldatas, descriptionHash);
    }

    function castVote(
        uint256 proposalId,
        uint8 support
    ) public override membersOnly returns (uint256) {
        require(
            state(proposalId) == ProposalState.Active,
            "MultiSigGovernance: voting is closed"
        );
        require(
            !hasVoted(proposalId, msg.sender),
            "OrganizationGovernance: you can vote only once in a voting period"
        );
        uint256 amount = 1;
        uint256 nWeight = getVotes(msg.sender, proposalSnapshot(proposalId));
        require(
            nWeight >= amount,
            "MultiSigGovernance::castVote: not enough voting power"
        );

        proposals[proposalId].votes = SafeMathUpgradeable.add(
            proposals[proposalId].votes,
            amount
        );
        proposals[proposalId].budget = 0;
        _countVote(proposalId, msg.sender, support, amount, "");
        proposals[proposalId].votesByMember[msg.sender] = amount;
        proposals[proposalId].lastUpdateTime[msg.sender] = block.timestamp;
        emit VoteCast(msg.sender, proposalId, support, amount, "");
        return amount;
    }

    function signers() public view returns (address[] memory) {
        return _signers;
    }

    function setSigners(address[] memory addresses) public organizationOnly {
        _signers = addresses;
    }

    function isSigner(address account) public view returns (bool) {
        uint256 signersLength = _signers.length;
        for (uint256 i = 0; i < signersLength; i++) {
            if (_signers[i] == account) {
                return true;
            }
        }
        return false;
    }
}
