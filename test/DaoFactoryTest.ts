import { ethers, upgrades } from "hardhat";
import { Contract, ContractFactory, Signer } from "ethers";
import { solidity } from "ethereum-waffle";
import { DAOFactory } from "../typechain-types";
import MembershipNFTABI from "../artifacts/contracts/MembershipNFT.sol/MembershipNFT.json";
import GovernanceTokenABI from "../artifacts/contracts/GovernanceToken.sol/GovernanceToken.json";
import TimeLockABI from "../artifacts/contracts/governance/TimeLock.sol/TimeLock.json";
import BoxABI from "../artifacts/contracts/Box.sol/Box.json";
import OrganizationGovernanceABI from "../artifacts/contracts/governance/OrganizationGovernance.sol/OrganizationGovernance.json";
import { BASE_URI, QUORUM_PERCENTAGE, VOTING_PERIOD } from "../helper-config";
import web3 from "web3";
import { expect } from "chai";

const chai = require("chai");
chai.use(solidity);

interface contractAddresses {
  membershipNFT: string;
  governanceToken: string;
  timeLock: string;
  organizationGovernance: string;
  box: string;
}

describe("DAOFactoryTest", function () {
  let owner: Signer;
  let address1: Signer;
  let address2: Signer;
  let address3: Signer;
  let signers: Signer[];

  let membershipNFT: Contract;
  let timelock: Contract;
  let governanceToken: Contract;
  let organizationGovernance: Contract;
  let box: any;
  let daoFactory: DAOFactory;

  describe("DAOFactoryUnitTests", function () {
    const initialSupply = 20;

    beforeEach(async function () {
      signers = await ethers.getSigners();
      owner = signers[0];
      address1 = signers[1];
      address2 = signers[2];
      address3 = signers[3];

      const governanceTokenFactory: ContractFactory =
        await ethers.getContractFactory("GovernanceToken");
      governanceToken = await governanceTokenFactory.deploy();
      await governanceToken.deployed();
      const membershipNFTFactory: ContractFactory =
        await ethers.getContractFactory("MembershipNFT");
      membershipNFT = await membershipNFTFactory.deploy();

      const timelockFactory: ContractFactory = await ethers.getContractFactory(
        "TimeLock"
      );
      timelock = await timelockFactory.deploy();
      await timelock.deployed();
      const organizationGovernanceFactory: ContractFactory =
        await ethers.getContractFactory("OrganizationGovernance");
      organizationGovernance = await organizationGovernanceFactory.deploy();
      await organizationGovernance.deployed();

      const boxFactory: ContractFactory = await ethers.getContractFactory(
        "Box"
      );
      box = await boxFactory.deploy();
      await box.deployed();

      const daoFactoryContractFactory: ContractFactory =
        await ethers.getContractFactory("DAOFactory");

      daoFactory = (await upgrades.deployProxy(
        daoFactoryContractFactory,
        [
          governanceToken.address,
          membershipNFT.address,
          timelock.address,
          organizationGovernance.address,
          box.address,
        ],
        { initializer: "initialize", kind: "transparent" }
      )) as DAOFactory;

      await daoFactory.deployed();
    });

    it("should create a new organization DAO", async function () {
      const tx = await daoFactory
        .connect(owner)
        .deployDAO(
          ethers.utils.formatBytes32String("test DAO"),
          "Some DAO clone for testing purposes",
          BASE_URI,
          10,
          VOTING_PERIOD,
          QUORUM_PERCENTAGE
        );
      const receipt = await tx.wait();
      const res = receipt.events!;
      console.log("=====================================");
      let clones: any = {};
      for (let i = 0; i < res.length - 1; i++) {
        if (res[i].event === "ClonedContractDeployed") {
          console.log(res[i].args);
          const contractType = web3.utils.hexToAscii(res[i].args!.contractType);
          const type = contractType.replace(/\u0000+$/, "");
          console.log(
            `New OrgDao ${type} deployed to:`,
            res[i]!.args!.deployedAddress
          );
          clones[type] = res[i]!.args!.deployedAddress;
        }
      }
      const addresses = clones as contractAddresses;

      const cloneGovTokenContract = new ethers.Contract(
        addresses.governanceToken,
        GovernanceTokenABI.abi,
        owner
      );
      const cloneMembershipNFTContract = new ethers.Contract(
        addresses.membershipNFT,
        MembershipNFTABI.abi,
        owner
      );
      const cloneTimeLockContract = new Contract(
        addresses.timeLock,
        TimeLockABI.abi,
        owner
      );
      const cloneOrgGovContract = new Contract(
        addresses.organizationGovernance,
        OrganizationGovernanceABI.abi,
        owner
      );
      const cloneBoxContract = await new Contract(
        addresses.box,
        BoxABI.abi,
        owner
      );
      const count = await daoFactory.getDAOCount();
      const daoData = await daoFactory.getDAO(count.toNumber() - 1);
      expect(daoData.name).to.equal(
        ethers.utils.formatBytes32String("test DAO")
      );
      expect(web3.utils.hexToUtf8(daoData.description)).to.equal(
        "Some DAO clone for testing purposes"
      );
      expect(daoData.governanceToken).to.equal(addresses.governanceToken);
      expect(daoData.membershipNFT).to.equal(addresses.membershipNFT);
      expect(daoData.timeLock).to.equal(addresses.timeLock);
      expect(daoData.organizationGovernance).to.equal(
        addresses.organizationGovernance
      );
      expect(daoData.box).to.equal(addresses.box);

      expect(await cloneOrgGovContract.votingPeriod()).to.equal(VOTING_PERIOD);
      expect(await cloneOrgGovContract.getQuorumNumerator()).to.equal(
        QUORUM_PERCENTAGE
      );

      expect(await cloneGovTokenContract.name()).to.equal("GovernanceToken");
      expect(await cloneGovTokenContract.symbol()).to.equal("GOV");
      expect(await cloneMembershipNFTContract.totalSupply()).to.equal(10);
      expect(await cloneMembershipNFTContract.getURI()).to.equal(BASE_URI);
    });
  });
});
