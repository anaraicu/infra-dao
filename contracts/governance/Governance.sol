// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/governance/GovernorUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorSettingsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorCountingSimpleUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorVotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorVotesQuorumFractionUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorTimelockControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
//import "@openzeppelin/contracts-upgradeable/contracts/governance/utils/IVotesUpgradeable.sol";
import "hardhat/console.sol";

contract Governance is
    Initializable,
    GovernorUpgradeable,
    GovernorSettingsUpgradeable,
    GovernorCountingSimpleUpgradeable,
    GovernorVotesUpgradeable,
    GovernorVotesQuorumFractionUpgradeable,
    GovernorTimelockControlUpgradeable
{
    address public membershipTokenAddress;
    address public tokenAddress;
    address public owner;
    address public organizationAddress;

    struct Proposal {
        address proposer;
        uint256 budget;
        string description;
        uint256 votes;
        mapping(address => uint256) lastUpdateTime;
        mapping(address => uint256) votesByMember;
    }

    uint256[] public proposalIds;
    mapping(uint256 => Proposal) public proposals;
    mapping(address => bool) public isAdmin;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        IVotesUpgradeable _token,
        IERC1155Upgradeable _membershipToken,
        TimelockControllerUpgradeable _timelock,
        uint256 _votingPeriod,
        uint256 _quorumPercentage,
        uint256 _proposalThreshold,
        address _organizationAddress
    ) public virtual initializer {
        __Governor_init("Governance");
        __GovernorSettings_init(
            1 /* 1 block */,
            _votingPeriod /* 1 week */,
            _proposalThreshold /* votings required to be able to propose */
        );
        __GovernorCountingSimple_init();
        __GovernorVotes_init(_token);
        __GovernorVotesQuorumFraction_init(_quorumPercentage);
        __GovernorTimelockControl_init(_timelock);
        membershipTokenAddress = address(_membershipToken);
        tokenAddress = address(_token);
        organizationAddress = _organizationAddress;
        owner = msg.sender;
    }

    modifier membersOnly() {
        require(
            IERC1155Upgradeable(membershipTokenAddress).balanceOf(
                msg.sender,
                0
            ) > 0,
            "Governance::membersOnly: not a member"
        );
        _;
    }

    modifier adminsOnly() {
        require(isAdmin[msg.sender], "Governance::adminsOnly: not an admin");
        _;
    }

    modifier organizationOnly() {
        require(
            msg.sender == organizationAddress || msg.sender == owner,
            "Governance::organizationOnly: not the owner or the organization"
        );
        _;
    }

    // The following functions are overrides required by Solidity.

    function votingDelay()
        public
        view
        override(IGovernorUpgradeable, GovernorSettingsUpgradeable)
        returns (uint256)
    {
        return super.votingDelay();
    }

    function votingPeriod()
        public
        view
        override(IGovernorUpgradeable, GovernorSettingsUpgradeable)
        returns (uint256)
    {
        return super.votingPeriod();
    }

    function quorum(
        uint256 blockNumber
    )
        public
        view
        override(IGovernorUpgradeable, GovernorVotesQuorumFractionUpgradeable)
        returns (uint256)
    {
        return super.quorum(blockNumber);
    }

    function getQuorumNumerator() public view virtual returns (uint256) {
        return super.quorumNumerator();
    }

    function state(
        uint256 proposalId
    )
        public
        view
        override(GovernorUpgradeable, GovernorTimelockControlUpgradeable)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }

    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    )
        public
        override(GovernorUpgradeable, IGovernorUpgradeable)
        membersOnly
        returns (uint256)
    {
        require(
            msg.sender != address(0),
            "Governance::propose: sender must not be 0 address"
        );
        require(
            targets.length == values.length &&
                targets.length == calldatas.length,
            "Governance::propose: proposal function information arity mismatch"
        );
        uint256 proposalId = hashProposal(
            targets,
            values,
            calldatas,
            keccak256(bytes(description))
        );
        proposalIds.push(proposalId);
        proposals[proposalId].proposer = msg.sender;
        proposals[proposalId].budget = 0;
        proposals[proposalId].description = description;
        proposals[proposalId].votes = 0;

        return super.propose(targets, values, calldatas, description);
    }

    function proposalThreshold()
        public
        view
        override(GovernorUpgradeable, GovernorSettingsUpgradeable)
        returns (uint256)
    {
        return super.proposalThreshold();
    }

    function _execute(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    )
        internal
        virtual
        override(GovernorUpgradeable, GovernorTimelockControlUpgradeable)
    {
        super._execute(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    )
        internal
        override(GovernorUpgradeable, GovernorTimelockControlUpgradeable)
        returns (uint256)
    {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor()
        internal
        view
        override(GovernorUpgradeable, GovernorTimelockControlUpgradeable)
        returns (address)
    {
        return super._executor();
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(GovernorUpgradeable, GovernorTimelockControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function getBalance() public view returns (uint256) {
        return IERC20Upgradeable(tokenAddress).balanceOf(address(this));
    }

    function withdraw(uint256 amount) public organizationOnly {
        SafeERC20Upgradeable.safeTransfer(
            IERC20Upgradeable(tokenAddress),
            msg.sender,
            amount
        );
    }

    function withdrawVote(uint256 proposalId) public virtual membersOnly {
        require(
            proposals[proposalId].votesByMember[msg.sender] > 0,
            "Governance: no votes registered for this member"
        );
        require(
            state(proposalId) == ProposalState.Active,
            "OrganizationGovernance: proposal is not active"
        );
        uint256 amount = proposals[proposalId].votesByMember[msg.sender];
        if (proposals[proposalId].budget > 0) {
            SafeERC20Upgradeable.safeTransfer(
                IERC20Upgradeable(tokenAddress),
                msg.sender,
                amount
            );
            proposals[proposalId].budget = SafeMathUpgradeable.sub(
                proposals[proposalId].budget,
                amount
            );
        }

        proposals[proposalId].votesByMember[msg.sender] = 0;
        proposals[proposalId].votes = SafeMathUpgradeable.sub(
            proposals[proposalId].votes,
            amount
        );
    }

    // Vote with all voting weight owned by the sender.
    function castVote(
        uint256 proposalId,
        uint8 support
    )
        public
        virtual
        override(GovernorUpgradeable, IGovernorUpgradeable)
        membersOnly
        returns (uint256)
    {
        uint256 nWeight = getVotes(msg.sender, proposalSnapshot(proposalId));
        require(nWeight > 0, "Governance::castVote: voter has no voting power");
        proposals[proposalId].budget = 0;
        proposals[proposalId].votes = SafeMathUpgradeable.add(
            proposals[proposalId].votes,
            nWeight
        );
        proposals[proposalId].lastUpdateTime[msg.sender] = block.timestamp;
        proposals[proposalId].votesByMember[msg.sender] += nWeight;
        emit VoteCast(msg.sender, proposalId, support, nWeight, "");
        return super.castVote(proposalId, support);
    }

    function setAdmins(address[] memory _admins) public organizationOnly {
        require(
            _admins.length > 0,
            "Governance::setAdmins: admins must not be empty"
        );
        for (uint256 i = 0; i < _admins.length; i++) {
            isAdmin[_admins[i]] = true;
        }
    }

    function setAdmin(address _admin) public organizationOnly {
        isAdmin[_admin] = true;
    }

    function removeAdmin(address _admin) public organizationOnly {
        isAdmin[_admin] = false;
    }

    function allProposalsFinished() public view returns (bool) {
        for (uint256 i = 0; i < proposalIds.length; i++) {
            if (
                state(proposalIds[i]) != ProposalState.Executed &&
                state(proposalIds[i]) != ProposalState.Canceled &&
                state(proposalIds[i]) != ProposalState.Expired
            ) {
                return false;
            }
        }
        return true;
    }

    function closeDAO() public organizationOnly returns (uint256) {
        require(
            allProposalsFinished(),
            "Governance::closeDAO: not all proposals are finished"
        );
        SafeERC20Upgradeable.safeTransfer(
            IERC20Upgradeable(tokenAddress),
            organizationAddress,
            IERC20Upgradeable(tokenAddress).balanceOf(address(this))
        );
        return this.getBalance();
    }
}
