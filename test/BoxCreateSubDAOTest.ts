import { ethers, network } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";
import {
  Box,
  GovernanceToken,
  MembershipNFT,
  MultiSigGovernance,
  OrganizationGovernance,
  QuadraticGovernance,
  TimeLock,
  TokenBasedGovernance,
  WeightedGovernance,
} from "../typechain-types";
import { solidity } from "ethereum-waffle";
import {
  getTokenAndGovernanceContracts,
  makeProposal,
  setAdminsMembersAndVotingPower,
} from "./OrganizationGovernanceTest";
import {
  developmentChains,
  MIN_DELAY,
  QUORUM_PERCENTAGE,
  VOTING_PERIOD,
  VOTING_REASON_EXAMPLE,
} from "../helper-config";
import { moveBlocks } from "../utils/move-blocks";
import { moveTime } from "../utils/move-time";
import web3 from "web3";
import TokenBasedGovernanceABI from "../artifacts/contracts/governance/TokenBasedGovernance.sol/TokenBasedGovernance.json";
import QuadraticGovernanceABI from "../artifacts/contracts/governance/QuadraticGovernance.sol/QuadraticGovernance.json";
import MultiSigGovernanceABI from "../artifacts/contracts/governance/MultiSigGovernance.sol/MultiSigGovernance.json";

const chai = require("chai");
chai.use(solidity);

async function deploySubGovernanceContracts() {
  const tokenBasedGovernanceFactory = await ethers.getContractFactory(
    "TokenBasedGovernance"
  );
  const tokenBasedGovernance = await tokenBasedGovernanceFactory.deploy();
  await tokenBasedGovernance.deployed();
  console.log("Governance deployed to:", tokenBasedGovernance.address);

  const weightedGovernanceFactory = await ethers.getContractFactory(
    "WeightedGovernance"
  );
  const weightedGovernance =
    (await weightedGovernanceFactory.deploy()) as WeightedGovernance;
  await weightedGovernance.deployed();
  console.log("TokenBasedGovernance deployed to:", weightedGovernance.address);

  const quadraticGovernanceFactory = await ethers.getContractFactory(
    "QuadraticGovernance"
  );
  const quadraticGovernance =
    (await quadraticGovernanceFactory.deploy()) as QuadraticGovernance;
  await quadraticGovernance.deployed();
  console.log("QuadraticGovernance deployed to:", quadraticGovernance.address);

  const multiSigGovernanceFactory = await ethers.getContractFactory(
    "MultiSigGovernance"
  );
  const multiSigGovernance =
    (await multiSigGovernanceFactory.deploy()) as MultiSigGovernance;
  await multiSigGovernance.deployed();
  console.log("MultiSigGovernance deployed to:", multiSigGovernance.address);
  return {
    tokenBasedGovernance,
    weightedGovernance,
    quadraticGovernance,
    multiSigGovernance,
  };
}

describe("BoxCreateSubDAOUnitTests", function () {
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

  let encodedFunctionCall: any;
  let targets: any[];
  let values: any[];
  let calldatas: any[];

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

    const impls = await deploySubGovernanceContracts();

    await (box as Box).registerSubDAOImplementations(
      impls.tokenBasedGovernance.address,
      impls.weightedGovernance.address,
      impls.quadraticGovernance.address,
      impls.multiSigGovernance.address
    );

    await setAdminsMembersAndVotingPower(
      membershipNFT,
      governanceToken,
      owner,
      address1,
      address2,
      address3
    );

    encodedFunctionCall = box.interface.encodeFunctionData("deploySubDAO", [
      ethers.utils.formatBytes32String("tokenBased"),
      ethers.utils.formatBytes32String("Name subDAO"),
      "Description of the subDAO",
      governanceToken.address,
      membershipNFT.address,
      VOTING_PERIOD,
      QUORUM_PERCENTAGE,
    ]);

    // Propose a new proposal
    targets = [box.address]; // Add target addresses
    values = [0]; // Add values
    calldatas = [encodedFunctionCall]; // Add calldatas

    const proposerRole = await timelock.PROPOSER_ROLE();
    const executorRole = await timelock.EXECUTOR_ROLE();

    const proposerTx = await timelock.grantRole(
      proposerRole,
      organizationGovernance.address
    );
    await proposerTx.wait(1);
    const executorTx = await timelock.grantRole(
      executorRole,
      organizationGovernance.address
    );
    await executorTx.wait(1);
  });

  it("should deploy a new subDAO for tokenBased", async function () {
    let boxDAO = box as Box;
    const tokenBasedTx = await boxDAO.deploySubDAO(
      ethers.utils.formatBytes32String("tokenBased"),
      ethers.utils.formatBytes32String("Name subDAO"),
      "Description of the subDAO",
      governanceToken.address,
      membershipNFT.address,
      VOTING_PERIOD,
      QUORUM_PERCENTAGE
    );
    const res = await tokenBasedTx.wait(1);

    const count = await boxDAO.getSubDAOCount();
    expect(count).to.equal(1);
    const subDAOData = await boxDAO.getSubDAO(0);
    expect(ethers.utils.parseBytes32String(subDAOData.name)).to.equal(
      "Name subDAO"
    );
    expect(ethers.utils.parseBytes32String(subDAOData.subDAOType)).to.equal(
      "tokenBased"
    );
    expect(web3.utils.hexToAscii(subDAOData.description)).to.equal(
      "Description of the subDAO"
    );
    const subDAO = new ethers.Contract(
      subDAOData.subDAOAddress,
      TokenBasedGovernanceABI.abi,
      owner
    );
    expect(await subDAO.votingPeriod()).to.equal(VOTING_PERIOD);
    expect(await subDAO.getQuorumNumerator()).to.equal(QUORUM_PERCENTAGE);
  });

  it("should deploy a new subDAO for quadratic", async function () {
    let boxDAO = box as Box;
    const quadraticTx = await boxDAO.deploySubDAO(
      ethers.utils.formatBytes32String("quadratic"),
      ethers.utils.formatBytes32String("Name subDAO"),
      "Description of the subDAO",
      governanceToken.address,
      membershipNFT.address,
      VOTING_PERIOD,
      QUORUM_PERCENTAGE
    );
    const res = await quadraticTx.wait(1);

    const count = await boxDAO.getSubDAOCount();
    expect(count).to.equal(1);
    const subDAOData = await boxDAO.getSubDAO(0);
    expect(ethers.utils.parseBytes32String(subDAOData.name)).to.equal(
      "Name subDAO"
    );
    expect(ethers.utils.parseBytes32String(subDAOData.subDAOType)).to.equal(
      "quadratic"
    );
    expect(web3.utils.hexToAscii(subDAOData.description)).to.equal(
      "Description of the subDAO"
    );
    const subDAO = new ethers.Contract(
      subDAOData.subDAOAddress,
      QuadraticGovernanceABI.abi,
      owner
    );
    expect(await subDAO.minQuadraticVoteThreshold()).to.equal(1);
    expect(await subDAO.votingPeriod()).to.equal(VOTING_PERIOD);
    expect(await subDAO.getQuorumNumerator()).to.equal(QUORUM_PERCENTAGE);
  });

  it("should deploy a new subDAO for multiSig", async function () {
    let boxDAO = box as Box;
    const multiSigTx = await boxDAO
      .connect(owner)
      .deploySubDAO(
        ethers.utils.formatBytes32String("multiSig"),
        ethers.utils.formatBytes32String("Name subDAO"),
        "Description of the subDAO",
        governanceToken.address,
        membershipNFT.address,
        VOTING_PERIOD,
        QUORUM_PERCENTAGE
      );
    const res = await multiSigTx.wait(1);

    const count = await boxDAO.getSubDAOCount();
    expect(count).to.equal(1);
    const subDAOData = await boxDAO.getSubDAO(0);
    expect(ethers.utils.parseBytes32String(subDAOData.name)).to.equal(
      "Name subDAO"
    );
    expect(ethers.utils.parseBytes32String(subDAOData.subDAOType)).to.equal(
      "multiSig"
    );
    expect(web3.utils.hexToAscii(subDAOData.description)).to.equal(
      "Description of the subDAO"
    );
    const subDAO = new ethers.Contract(
      subDAOData.subDAOAddress,
      MultiSigGovernanceABI.abi,
      owner
    );
    await subDAO.connect(owner).addSigner(address1.getAddress());
    expect(await subDAO.isSigner(address1.getAddress())).to.equal(true);
    await subDAO.connect(owner).removeSigner(address1.getAddress());
    expect(await subDAO.isSigner(address1.getAddress())).to.equal(false);
    await subDAO.connect(owner).setRequiredSignatures(2);
    expect(await subDAO.requiredSignatures()).to.equal(2);
    expect(await subDAO.votingPeriod()).to.equal(VOTING_PERIOD);
    expect(await subDAO.getQuorumNumerator()).to.equal(QUORUM_PERCENTAGE);
  });

  it("should deploy new subDAO with a new implementation using clones from a proposal outcome", async function () {
    const description =
      "Deploy new subDAO with simple governance implementation";
    const descriptionHash = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(description)
    );

    console.log(`====================================`);
    console.log("Owner address: ", await owner.getAddress());
    console.log("Timelock address: ", timelock.address);
    console.log(`====================================`);

    const { proposalId, proposalSnapshot } = await makeProposal(
      encodedFunctionCall,
      targets,
      values,
      organizationGovernance,
      address1,
      calldatas,
      description
    );

    expect(await organizationGovernance.state(proposalId)).to.equal(1);

    console.log(
      `VP of signers: [${await governanceToken
        .connect(owner)
        .balanceOf(await owner.getAddress())}, ${await governanceToken
        .connect(address1)
        .getVotes(await address1.getAddress())}, ${await governanceToken
        .connect(address2)
        .getVotes(await address2.getAddress())}, ${await governanceToken
        .connect(address3)
        .getVotes(await address3.getAddress())}]`
    );

    console.log(`====================================`);
    console.log(`Voting on proposal ${proposalId}`);
    console.log(`====================================`);

    const voteTx1 = await organizationGovernance
      .connect(address1)
      ["castVote(uint256,uint8,string)"](proposalId, 1, VOTING_REASON_EXAMPLE);
    await voteTx1.wait(1);
    expect(voteTx1)
      .to.emit(organizationGovernance, "VoteCast")
      .withArgs(
        await address1.getAddress(),
        proposalId,
        1,
        1,
        VOTING_REASON_EXAMPLE
      );

    const voteTx2 = await organizationGovernance
      .connect(address2)
      ["castVote(uint256,uint8)"](proposalId, 1);
    await voteTx2.wait(1);
    expect(voteTx2)
      .to.emit(organizationGovernance, "VoteCast")
      .withArgs(await address2.getAddress(), proposalId, 1, 1, "");

    expect(
      organizationGovernance
        .connect(address3)
        ["castVote(uint256,uint8,string)"](proposalId, 1, VOTING_REASON_EXAMPLE)
    ).to.be.revertedWith("OrganizationGovernance::membersOnly: not a member");
    // VOTING POWER implementation

    if (developmentChains.includes(network.name)) {
      await moveBlocks(VOTING_PERIOD + 1);
    }

    const votingResult = await organizationGovernance.proposalVotes(proposalId);
    console.log(`Voting result: ${votingResult}`);
    console.log(
      `Quorum: ${await organizationGovernance.quorum(proposalSnapshot)}`
    );
    expect(await organizationGovernance.state(proposalId)).to.equal(4);
    const proposalFinal = await organizationGovernance.proposals(proposalId);
    expect(await proposalFinal.votes).to.equal(2);

    console.log("Queueing...");
    const queueTx = await organizationGovernance.queue(
      [box.address],
      [0],
      [encodedFunctionCall],
      descriptionHash
    );
    await queueTx.wait(1);

    if (developmentChains.includes(network.name)) {
      await moveTime(MIN_DELAY + 1);
      await moveBlocks(1);
    }

    console.log("Executing");
    const executeTx = await organizationGovernance.execute(
      [box.address],
      [0],
      [encodedFunctionCall],
      descriptionHash
    );
    await executeTx.wait(1);

    const count = await box.getSubDAOCount();
    console.log(`SubDAO count: ${count}`);
    const subDAOData = await box.getSubDAO(count - 1);

    console.log(subDAOData);

    console.log(
      `SubDAO name: ${ethers.utils.parseBytes32String(subDAOData.name)}`
    );
    console.log(
      `SubDAO description: ${web3.utils.hexToUtf8(subDAOData.description)}`
    );
    console.log(`SubDAO address: ${subDAOData.subDAOAddress}`);
    console.log(
      `SubDAO Type: ${ethers.utils.parseBytes32String(subDAOData.subDAOType)}`
    );

    const subDAO = new ethers.Contract(
      subDAOData.subDAOAddress,
      TokenBasedGovernanceABI.abi,
      owner
    );
    console.log(`SUB DAO Voting period: ${await subDAO.votingPeriod()}`);
  });
});
