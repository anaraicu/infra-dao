// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// MultiSigGovernance is extending Governance class with MultiSignature voting
import "./Governance.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract MultiSigGovernance is Governance {
    using EnumerableSet for EnumerableSet.AddressSet;

    uint256 public requiredSignatures;
    EnumerableSet.AddressSet private signers;

    modifier signersOnly() {
        require(
            isSigner(msg.sender),
            "MultiSigGovernance::signersOnly: not a signer"
        );
        _;
    }

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
        Governance.initialize(
            _token,
            membershipToken,
            _timelock,
            _votingPeriod,
            _quorumPercentage,
            _proposalThreshold,
            _organizationAddress
        );
        requiredSignatures = 4;
    }

    function _execute(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override {
        uint256 signs = 0;
        uint256 signersLength = getSignersLength();
        ///
        for (
            uint256 i = 0;
            i < signersLength && signs < requiredSignatures;
            i++
        ) {
            if (proposals[proposalId].votesByMember[signers.at(i)] == 1) {
                signs++;
            }
        }
        require(
            signs >= requiredSignatures || signs == signersLength,
            "MultiSigGovernance: not enough signatures"
        );
        super._execute(proposalId, targets, values, calldatas, descriptionHash);
    }

    function castVote(
        uint256 proposalId,
        uint8 support,
        string memory reason
    ) public payable override signersOnly returns (uint256) {
        require(
            state(proposalId) == ProposalState.Active,
            "MultiSigGovernance::castVote: voting is closed"
        );
        require(
            !hasVoted(proposalId, msg.sender),
            "OrganizationGovernance::castVote: you can vote only once in a voting period"
        );
        uint256 amount = 1;
        uint256 nWeight = getVotes(msg.sender, proposalSnapshot(proposalId));
        require(
            nWeight >= amount,
            "MultiSigGovernance::castVote: not enough voting power"
        );
        proposals[proposalId].votes = proposals[proposalId].votes + amount;
        proposals[proposalId].budget = 0;
        _countVote(proposalId, msg.sender, support, amount, "");
        proposals[proposalId].votesByMember[msg.sender] = support;
        emit VoteCast(msg.sender, proposalId, support, amount, reason);
        return amount;
    }

    function castVote(
        uint256 proposalId,
        uint8 support
    ) public override signersOnly returns (uint256) {
        return castVote(proposalId, support, "");
    }

    function setSigners(address[] memory addresses) public organizationOnly {
        for (uint256 i = 0; i < addresses.length; i++) {
            EnumerableSet.add(signers, addresses[i]);
        }
    }

    function addSigner(address addr) public organizationOnly {
        EnumerableSet.add(signers, addr);
    }

    function removeSigner(address addr) public organizationOnly {
        EnumerableSet.remove(signers, addr);
    }

    function getSigners() public view returns (address[] memory) {
        address[] memory addresses = new address[](
            EnumerableSet.length(signers)
        );
        for (uint256 i = 0; i < EnumerableSet.length(signers); i++) {
            addresses[i] = EnumerableSet.at(signers, i);
        }
        return addresses;
    }

    function isSigner(address addr) public view returns (bool) {
        return EnumerableSet.contains(signers, addr);
    }

    function getSignersLength() public view returns (uint256) {
        return EnumerableSet.length(signers);
    }

    function getSignerAt(uint256 index) public view returns (address) {
        return EnumerableSet.at(signers, index);
    }

    function setRequiredSignatures(uint256 amount) public organizationOnly {
        requiredSignatures = amount;
    }
}
