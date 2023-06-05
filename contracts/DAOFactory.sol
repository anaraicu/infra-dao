// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";
import "./governance/TimeLock.sol";
import "./governance/OrganizationGovernance.sol";
import "./GovernanceToken.sol";
import "./MembershipNFT.sol";
import "./Box.sol";

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
        bytes32 name;
        bytes description;
    }

    event ClonedContractDeployed(bytes32 contractType, address deployedAddress);
    event DAODeployed(address deployedAddress);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _governanceToken,
        address _membershipNFT,
        address _timeLock,
        address _organizationGovernance,
        address _box
    ) public initializer {
        __Ownable_init();
        governanceToken = _governanceToken;
        membershipNFT = _membershipNFT;
        box = _box;
        organizationGovernance = _organizationGovernance;
        timeLock = _timeLock;
    }

    function deployDAO(
        bytes32 name,
        string memory description,
        string memory uri,
        uint256 initialSupply,
        uint256 votingPeriod,
        uint256 quorumPercentage
    ) public payable returns (address, address, address, address, address) {
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
        newDAO.name = name;
        newDAO.description = abi.encodePacked(description);
        newDAO.governanceToken = ClonesUpgradeable.clone(governanceToken);
        GovernanceToken(newDAO.governanceToken).initialize();
        emit ClonedContractDeployed("governanceToken", newDAO.governanceToken);

        newDAO.membershipNFT = ClonesUpgradeable.clone(membershipNFT);
        MembershipNFT(newDAO.membershipNFT).initialize(uri, initialSupply);
        emit ClonedContractDeployed("membershipNFT", newDAO.membershipNFT);

        newDAO.timeLock = ClonesUpgradeable.clone(timeLock);
        newDAO.organizationGovernance = ClonesUpgradeable.clone(
            organizationGovernance
        );
        address[] memory executors = new address[](1);
        executors[0] = newDAO.organizationGovernance;
        TimeLock(payable(newDAO.timeLock)).initialize(
            10,
            executors,
            executors,
            _msgSender()
        );
        emit ClonedContractDeployed("timeLock", newDAO.timeLock);

        OrganizationGovernance(payable(newDAO.organizationGovernance))
            .initialize(
                GovernanceToken(newDAO.governanceToken),
                MembershipNFT(newDAO.membershipNFT),
                TimeLock(payable(newDAO.timeLock)),
                votingPeriod,
                quorumPercentage,
                0
            );
        emit ClonedContractDeployed(
            "organizationGovernance",
            newDAO.organizationGovernance
        );

        newDAO.box = ClonesUpgradeable.clone(box);
        Box(newDAO.box).initialize(newDAO.timeLock);
        emit ClonedContractDeployed("box", newDAO.box);

        deployedDAOs.push(newDAO);
        emit DAODeployed(address(newDAO.box));

        return (
            newDAO.box,
            newDAO.organizationGovernance,
            newDAO.governanceToken,
            newDAO.membershipNFT,
            newDAO.timeLock
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

    fallback() external {
        revert();
    }
}
