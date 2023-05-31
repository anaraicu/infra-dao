// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";
import "hardhat/console.sol";

// A box contract for storing governor and mapping the admins according to their NFT posession
contract Box is OwnableUpgradeable {
    address public governor;
    mapping(address => bool) public admins;
    uint256 public value; // trivial value to store in the contract

    mapping(bytes32 => address) public subDAOs;
    address[] public subDAOAddresses;
    address public originalOwner;

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

        originalOwner = msg.sender;
        _transferOwnership(_governor);
    }

    function registerSubDAO(
        bytes32 id,
        address subDAOImplementation
    ) public ownersOnly {
        require(
            subDAOs[id] == address(0),
            "Box::registerSubDAO: SubDAO already registered"
        );
        subDAOs[id] = subDAOImplementation;
    }

    function deploySubDAO(bytes32 id) external ownersOnly returns (address) {
        address deployed = ClonesUpgradeable.clone(subDAOs[id]);
        emit SubDAOAdded(id, deployed);
        subDAOAddresses.push(deployed);
        return deployed;
    }

    // Stores a new value in the contract
    function store(uint256 newValue) public onlyOwner {
        value = newValue;
        emit ValueChanged(newValue);
    }

    function retrieve() public view returns (uint256) {
        return value;
    }

    function retrieveLastDeployed() public view returns (address) {
        return subDAOAddresses[subDAOAddresses.length - 1];
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
