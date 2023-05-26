// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";

contract DAOFactory is OwnableUpgradeable {
    address public organizationGovernance;
    address public governanceToken;
    address public membershipNFT;
    address public box;
    address public timeLock;

    DAO[] public deployedDAOs;

    struct DAO {
        address organizationGovernance;
        address governanceToken;
        address membershipNFT;
        address box;
        address timeLock;
    }

    event ClonedContractDeployed(bytes32 contractType, address deployedAddress);
    event DAODeployed(address deployedAddress);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _organizationGovernance,
        address _governanceToken,
        address _membershipNFT,
        address _box,
        address _timeLock
    ) public initializer {
        __Ownable_init();
        organizationGovernance = _organizationGovernance;
        governanceToken = _governanceToken;
        membershipNFT = _membershipNFT;
        box = _box;
        timeLock = _timeLock;
    }

    function deployDAO()
        public
        returns (address, address, address, address, address)
    {
        require(
            organizationGovernance != address(0),
            "organizationGovernance not registered"
        );
        require(
            governanceToken != address(0),
            "governanceToken not registered"
        );
        require(membershipNFT != address(0), "membershipNFT not registered");
        require(box != address(0), "box not registered");
        require(timeLock != address(0), "timeLock not registered");

        DAO memory newDAO;
        newDAO.governanceToken = ClonesUpgradeable.clone(governanceToken);
        emit ClonedContractDeployed("governanceToken", newDAO.governanceToken);

        newDAO.membershipNFT = ClonesUpgradeable.clone(membershipNFT);
        emit ClonedContractDeployed("membershipNFT", newDAO.membershipNFT);

        newDAO.timeLock = ClonesUpgradeable.clone(timeLock);
        emit ClonedContractDeployed("timeLock", newDAO.timeLock);

        newDAO.organizationGovernance = ClonesUpgradeable.clone(
            organizationGovernance
        );
        emit ClonedContractDeployed(
            "organizationGovernance",
            newDAO.organizationGovernance
        );

        newDAO.box = ClonesUpgradeable.clone(box);
        emit ClonedContractDeployed("box", newDAO.box);

        deployedDAOs.push(newDAO);
        emit DAODeployed(address(newDAO.box));

        return (
            newDAO.governanceToken,
            newDAO.membershipNFT,
            newDAO.timeLock,
            newDAO.organizationGovernance,
            newDAO.box
        );
    }

    function getDAOs() public view returns (DAO[] memory) {
        return deployedDAOs;
    }

    function getDAO(uint256 index) public view returns (DAO memory) {
        return deployedDAOs[index];
    }

    function getDAOCount() public view returns (uint256) {
        return deployedDAOs.length;
    }
}
