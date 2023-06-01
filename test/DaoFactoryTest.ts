import { ethers, upgrades } from "hardhat";
import { Signer } from "ethers";
import { solidity } from "ethereum-waffle";
import {
  Box,
  DAOFactory,
  DAOFactory__factory,
  GovernanceToken,
  MembershipNFT,
  OrganizationGovernance,
  TimeLock,
} from "../typechain-types";
import {
  BASE_URI,
  PROPOSAL_THRESHOLD,
  QUORUM_PERCENTAGE,
} from "../helper-config";
import { getTokenAndGovernanceContracts } from "./OrganizationGovernanceTest";
import web3 from "web3";

const chai = require("chai");
chai.use(solidity);
const hre = require("hardhat");

describe("DAOFactoryTest", function () {
  let owner: Signer;
  let address1: Signer;
  let address2: Signer;
  let address3: Signer;
  let signers: Signer[];

  let membershipNFT: MembershipNFT;
  let timelock: TimeLock;
  let governanceToken: GovernanceToken;
  let organizationGovernance: OrganizationGovernance;
  let box: any;
  let daoFactory: DAOFactory;

  let encodedFunctionCall: any;
  let targets: any[];
  let values: any[];
  let calldatas: any[];

  let cloneGovTokenContract: any;
  let cloneMembershipNFTContract: any;
  let cloneTimeLockContract: any;
  let cloneOrgGovContract: any;
  let cloneBoxContract: any;

  describe("DAOFactoryUnitTests", function () {
    const initialSupply = 20;

    beforeEach(async function () {
      signers = await ethers.getSigners();
      owner = signers[0];
      address1 = signers[1];
      address2 = signers[2];
      address3 = signers[3];

      const res = await getTokenAndGovernanceContracts(owner, initialSupply);
      membershipNFT = res.membershipNFT;
      timelock = res.timelock;
      governanceToken = res.governanceToken;
      organizationGovernance = res.organizationGovernance;
      box = res.box;

      const DaoFactory = (await ethers.getContractFactory(
        "DAOFactory",
        owner
      )) as DAOFactory__factory;
      daoFactory = (await upgrades.deployProxy(
        DaoFactory,
        [
          governanceToken.address,
          membershipNFT.address,
          organizationGovernance.address,
          timelock.address,
          box.address,
        ],
        { initializer: "initialize", kind: "transparent" }
      )) as DAOFactory;

      await daoFactory.deployed();

      console.log("=====================================");
      console.log("DAOFactory deployed to:", daoFactory);
    });

    it("should create a subDAO", async function () {
      const tx = await daoFactory.deployDAO(
        BASE_URI,
        initialSupply,
        QUORUM_PERCENTAGE,
        PROPOSAL_THRESHOLD
      );
      const receipt = await tx.wait();
      const res = receipt.events!;

      for (let i = 0; i < res.length - 1; i++) {
        const contractType = web3.utils.hexToAscii(res[i].args!.contractType);
        const type = contractType.replace(/\u0000+$/, "");
        // data["orgDao" + count.toNumber()][type] = res[i]!.args!.deployedAddress;
        console.log(`New OrgDao ${type} deployed to:`);
      }
      const cloneGovToken = res[0]!.args!.deployedAddress;
      const cloneMembershipNFT = res[1]!.args!.deployedAddress;
      const cloneTimeLock = res[2]!.args!.deployedAddress;
      const cloneOrgGov = res[3]!.args!.deployedAddress;
      const cloneBox = res[4]!.args!.deployedAddress;
      console.log("=====================================");
      const cloneGovTokenContract = (await ethers.getContractAt(
        "GovernanceToken",
        cloneGovToken
      )) as GovernanceToken;
      console.log("=====================================");
      const cloneMembershipNFTContract = (await ethers.getContractAt(
        "MembershipNFT",
        cloneMembershipNFT
      )) as MembershipNFT;
      console.log("=====================================");
      const cloneTimeLockContract = (await ethers.getContractAt(
        "TimeLock",
        cloneTimeLock
      )) as TimeLock;
      console.log("=====================================");
      const cloneOrgGovContract = (await ethers.getContractAt(
        "OrganizationGovernance",
        cloneOrgGov
      )) as OrganizationGovernance;
      console.log("=====================================");
      const cloneBoxContract = (await ethers.getContractAt(
        "Box",
        cloneBox
      )) as Box;
      console.log(await cloneMembershipNFTContract.getURI());
    });
  });
});
