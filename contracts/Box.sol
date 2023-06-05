// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";
import "hardhat/console.sol";
import "@openzeppelin/contracts-upgradeable/governance/TimelockControllerUpgradeable.sol";

interface IGovernance {
    function initialize(
        IVotesUpgradeable _token,
        IERC1155Upgradeable _membershipToken,
        TimelockControllerUpgradeable _timelock,
        uint256 _votingPeriod,
        uint256 _quorumPercentage,
        uint256 _proposalThreshold,
        address _organizationAddress
    ) external;
}

// A box contract for storing governor and mapping the admins according to their NFT posession
contract Box is OwnableUpgradeable {
    address public governor;
    mapping(address => bool) public admins;
    uint256 public value; // trivial value to store in the contract

    mapping(bytes32 => address) public subDAOImplementations;
    subDAO[] public subDAOs;
    address public originalOwner;

    struct subDAO {
        bytes32 subDAOType;
        address subDAOAddress;
        bytes32 name;
        bytes description;
    }

    event getGas(uint256 gas);
    event ValueChanged(uint256 newValue);
    event SubDAOAdded(bytes32 subDAOId, address subDAOAddress);

    modifier ownersOnly() {
        require(
            msg.sender == originalOwner || msg.sender == owner(),
            "Box::originalOwnerOnly: Only original owner can call this function"
        );
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _governor) public initializer {
        __Ownable_init();
        governor = _governor;

        //        originalOwner = msg.sender;
        _transferOwnership(_governor);
        originalOwner = tx.origin;
    }

    function registerSubDAOImplementations(
        address simple,
        address tokenBased,
        address quadratic,
        address multiSig
    ) public ownersOnly {
        require(
            simple != address(0),
            "Box::registerSubDAO: Simple address cannot be 0"
        );
        require(
            tokenBased != address(0),
            "Box::registerSubDAO: TokenBased address cannot be 0"
        );
        require(
            quadratic != address(0),
            "Box::registerSubDAO: Quadratic address cannot be 0"
        );
        require(
            multiSig != address(0),
            "Box::registerSubDAO: MultiSig address cannot be 0"
        );

        subDAOImplementations[bytes32("simple")] = simple;
        subDAOImplementations[bytes32("tokenBased")] = tokenBased;
        subDAOImplementations[bytes32("quadratic")] = quadratic;
        subDAOImplementations[bytes32("multiSig")] = multiSig;
    }

    function deploySubDAO(
        bytes32 id,
        bytes32 name,
        string memory description,
        address governanceToken,
        address membershipNFT,
        uint256 votingPeriod,
        uint256 quorumPercentage
    ) external ownersOnly returns (address) {
        console.log("deploying subDAO");
        console.log("--------------------");
        console.log(subDAOImplementations[id]);
        address deployed = ClonesUpgradeable.clone(subDAOImplementations[id]);
        IGovernance(deployed).initialize(
            IVotesUpgradeable(governanceToken),
            IERC1155Upgradeable(membershipNFT),
            TimelockControllerUpgradeable(payable(governor)),
            votingPeriod,
            quorumPercentage,
            0,
            address(this)
        );

        console.log("deployed subDAO: ", deployed);
        emit SubDAOAdded(id, deployed);
        subDAOs.push(subDAO(id, deployed, name, abi.encodePacked(description)));
        return deployed;
    }

    function getSubDAO(uint256 index) public view returns (subDAO memory) {
        return subDAOs[index];
    }

    function getSubDAOs() public view returns (subDAO[] memory) {
        return subDAOs;
    }

    function getSubDAOCount() public view returns (uint256) {
        return subDAOs.length;
    }

    // Stores a new value in the contract
    function store(uint256 newValue) public onlyOwner {
        value = newValue;
        emit ValueChanged(newValue);
    }

    function retrieve() public view returns (uint256) {
        return value;
    }

    function setGovernor(address _governor) public onlyOwner {
        governor = _governor;
    }

    function setAdmin(address _admin) public onlyOwner {
        admins[_admin] = true;
    }

    function removeAdmin(address _admin) public onlyOwner {
        admins[_admin] = false;
    }

    function isAdmin(address _admin) public view returns (bool) {
        return admins[_admin];
    }

    /**
     * @dev emit logs for gasleft
     */
    function getLogs() public onlyOwner {
        emit getGas(gasleft());
    }
}
