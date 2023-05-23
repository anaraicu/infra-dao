// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/governance/GovernorUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorSettingsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorCountingSimpleUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorVotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorVotesQuorumFractionUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorTimelockControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
//import "@openzeppelin/contracts-upgradeable/contracts/governance/utils/IVotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "hardhat/console.sol";

contract OrganizationGovernance is
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
    address owner;

    enum GovernanceType {
        TokenQuorum,
        Quadratic,
        SimpleMajority,
        MultiSig,
        PoP
    }

    struct Proposal {
        address proposer;
        uint256 budget;
        string description;
        uint256 votes;
        mapping(address => uint256) lastUpdateTime;
        mapping(address => uint256) votesByMember;
    }

    uint256[] public proposalIds;
    address[] public subDAO;
    mapping(uint256 => Proposal) public proposals;
    mapping(address => bool) public isAdmin;

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
        uint256 _proposalThreshold
    ) public initializer {
        __Governor_init("OrganizationGovernance");
        __GovernorSettings_init(
            1 /* 1 block */,
            _votingPeriod /* 1 week */,
            _proposalThreshold
        );
        __GovernorCountingSimple_init();
        __GovernorVotes_init(_token);
        __GovernorVotesQuorumFraction_init(_quorumPercentage);
        __GovernorTimelockControl_init(_timelock);

        owner = msg.sender;
        membershipTokenAddress = address(membershipToken);
        tokenAddress = address(_token);
    }

    modifier adminsOnly() {
        require(
            isAdmin[msg.sender],
            "OrganizationGovernance::adminsOnly: not an admin"
        );
        _;
    }

    modifier membersOnly() {
        require(
            IERC1155Upgradeable(membershipTokenAddress).balanceOf(
                msg.sender,
                0
            ) > 0,
            "OrganizationGovernance::membersOnly: not a member"
        );
        _;
    }

    modifier daoOnly() {
        require(
            msg.sender == owner,
            "OrganizationGovernance::daoOnly: not a dao call"
        );
        _;
    }

    modifier timeLockOnly() {
        require(
            msg.sender == timelock(),
            "OrganizationGovernance::timeLockOnly: not a timelock call"
        );
        _;
    }

    function setAdmins(address[] memory _admins) public daoOnly {
        require(
            _admins.length > 0,
            "OrganizationGovernance::setAdmins: admins must not be empty"
        );
        for (uint256 i = 0; i < _admins.length; i++) {
            isAdmin[_admins[i]] = true;
        }
    }

    function setAdmin(address _admin) public daoOnly {
        isAdmin[_admin] = true;
    }

    function removeAdmin(address _admin) public daoOnly {
        isAdmin[_admin] = false;
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

    function setVotingPeriod(uint256 timeSeconds) public override daoOnly {
        _setVotingPeriod(timeSeconds);
        // receive in seconds
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

    function setQuorumFraction(uint256 _quorumFraction) public virtual daoOnly {
        _updateQuorumNumerator(_quorumFraction);
    }

    function setQuorumNumeric(uint256 _quorum) public virtual daoOnly {
        _updateQuorumNumerator(SafeMathUpgradeable.mul(_quorum, 100));
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
            "OrganizationGovernance::propose: sender must not be 0 address"
        );
        require(
            targets.length == values.length &&
                targets.length == calldatas.length,
            "OrganizationGovernance::propose: proposal function information arity mismatch"
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

    function createSubDaoProject(address _subDAO) public daoOnly {
        require(
            _subDAO != address(0),
            "OrganizationGovernance::createSubDaoProject: subDAO must not be 0 address"
        );

        subDAO.push(_subDAO);
    }

    function getProposer(uint256 proposalId) external view returns (address) {
        return proposals[proposalId].proposer;
    }

    function getProposerBudget(
        uint256 proposalId
    ) external view returns (uint256) {
        return proposals[proposalId].budget;
    }

    function proposalThreshold()
        public
        view
        override(GovernorUpgradeable, GovernorSettingsUpgradeable)
        returns (uint256)
    {
        return super.proposalThreshold();
    }

    function setProposalThreshold(
        uint256 threshold
    ) public virtual override(GovernorSettingsUpgradeable) daoOnly {
        super._setProposalThreshold(threshold);
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

    function withdrawVote(uint256 proposalId) public membersOnly {
        require(
            proposals[proposalId].budget > 0 &&
                proposals[proposalId].votesByMember[msg.sender] > 0,
            "OrganizationGovernance: no votes registered for this member"
        );
        require(
            state(proposalId) == ProposalState.Active,
            "OrganizationGovernance: proposal is not active"
        );
        uint256 amount = proposals[proposalId].votesByMember[msg.sender];
        SafeERC20Upgradeable.safeTransfer(
            IERC20Upgradeable(tokenAddress),
            msg.sender,
            amount
        );
        proposals[proposalId].votesByMember[msg.sender] = 0;
        proposals[proposalId].votes = SafeMathUpgradeable.sub(
            proposals[proposalId].votes,
            amount
        );
        proposals[proposalId].budget = SafeMathUpgradeable.sub(
            proposals[proposalId].budget,
            amount
        );
    }

    function withdraw(uint256 proposalId, address account) internal {
        require(
            state(proposalId) == ProposalState.Succeeded ||
                state(proposalId) == ProposalState.Executed,
            "OrganizationGovernance: proposal not successful for withdrawing funds"
        );
        SafeERC20Upgradeable.safeTransfer(
            IERC20Upgradeable(tokenAddress),
            account,
            proposals[proposalId].budget
        );
    }

    function transferProposalFunds(
        uint256 proposalId,
        address account
    ) public daoOnly {
        require(
            state(proposalId) == ProposalState.Succeeded ||
                state(proposalId) == ProposalState.Executed,
            "OrganizationGovernance: proposal not successful for withdrawing funds"
        );
        withdraw(proposalId, account);
    }

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
        require(
            !hasVoted(proposalId, msg.sender),
            "OrganizationGovernance: you can vote only once in a voting period"
        );
        require(
            state(proposalId) == ProposalState.Active,
            "OrganizationGovernance: voting is closed"
        );
        uint256 voteWeight = 1;
        require(
            getVotes(msg.sender, proposalSnapshot(proposalId)) >= voteWeight,
            "OrganizationGovernance::castVote: voter does not have enough voting power"
        );

        proposals[proposalId].votes = SafeMathUpgradeable.add(
            proposals[proposalId].votes,
            voteWeight
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
}
