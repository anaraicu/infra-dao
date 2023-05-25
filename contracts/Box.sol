// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";

// A box contract for storing governor and mapping the admins according to their NFT posession
contract Box is OwnableUpgradeable {
    address public governor;
    mapping(address => bool) public admins;
    uint256 public value;

    mapping(bytes32 => address) public subDAOs;
    address[] public subDAOAddresses;

    event getGas(uint256 gas);
    event ValueChanged(uint256 newValue);
    event SubDAOAdded(bytes32 subDAOId, address subDAOAddress);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _governor) public initializer {
        __Ownable_init();
        governor = _governor;
        _transferOwnership(_governor);
    }

    function registerSubDAO(bytes32 id, address subDAOImplementation) public {
        subDAOs[id] = subDAOImplementation;
    }

    function deploySubDAO(bytes32 id) external returns (address) {
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
     * @dev Withdraws all funds from the contract.
     */
    function withdraw(address _receiver) public onlyOwner {
        address payable receiverPayable = payable(_receiver);
        receiverPayable.transfer(address(this).balance);
    }

    /**
     * @dev emit logs for gasleft
     */
    function getLogs() public onlyOwner {
        emit getGas(gasleft());
    }
}
