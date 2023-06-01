import { ethers, network, upgrades } from "hardhat";
import { expect } from "chai";
import { Contract, ContractFactory, Signer } from "ethers";
import { solidity } from "ethereum-waffle";
import {
  MembershipNFT,
  MembershipNFT__factory,
  OrganizationGovernance,
  GovernanceToken,
  TimeLock,
  Governance,
} from "../typechain-types";
import {
  developmentChains,
  MIN_DELAY,
  PROPOSAL_THRESHOLD,
  QUORUM_PERCENTAGE,
  STORE_FUNC,
  STORE_VALUE,
  VOTING_DELAY,
  VOTING_PERIOD,
  VOTING_REASON_EXAMPLE,
} from "../helper-config";
import { moveBlocks } from "../utils/move-blocks";
import { toUtf8Bytes } from "ethers/lib/utils";
import { moveTime } from "../utils/move-time";

const chai = require("chai");
chai.use(solidity);
const hre = require("hardhat");

export async function makeProposal(
  encodedFunctionCall: any,
  targets: any[],
  values: any[],
  organizationGovernance: any,
  address1: Signer,
  calldatas: any[],
  description: string
) {
  console.log(`Encoded function to call ${encodedFunctionCall}`);
  console.log(`Proposing ${targets[0]} with args ${values}`);

  console.log("Proposing...");

  const proposeTx = await organizationGovernance
    .connect(address1)
    .propose(targets, values, calldatas, description, {
      gasLimit: 500000,
    });
  if (developmentChains.includes(network.name)) {
    await moveBlocks(VOTING_DELAY + 1);
  }
  await proposeTx.wait(1);
  const proposalId = await organizationGovernance.proposalIds(0);
  const proposal = await organizationGovernance.proposals(proposalId);
  const proposalSnapshot = await organizationGovernance.proposalSnapshot(
    proposalId
  );
  console.log(`Deployed proposal with id ${proposalId}`);
  console.log(`Proposal: ${proposal}`);
  console.log(`Proposal description: ${description}`);
  console.log(`Proposal snapshot: ${proposalSnapshot}`);
  expect(proposal.proposer).to.equal(await address1.getAddress());
  expect(proposal.description).to.equal(description);
  expect(proposal.votes).to.equal(0);
  return { proposalId, proposalSnapshot };
}

export async function getTokenAndGovernanceContracts(
  owner: Signer,
  initialSupply: number
) {
  const uri =
    "https://bafybeihul6zsmbzyrgmjth3ynkmchepyvyhcwecn2yxc57ppqgpvr35zsq.ipfs.dweb.link/0.json";

  const membershipNFTFactory = (await ethers.getContractFactory(
    "MembershipNFT",
    owner
  )) as MembershipNFT__factory;
  const membershipNFT = (await upgrades.deployProxy(
    membershipNFTFactory,
    [uri, initialSupply],
    { initializer: "initialize", kind: "transparent" }
  )) as MembershipNFT;
  await membershipNFT.deployed();

  const timeLockFactory: ContractFactory = await ethers.getContractFactory(
    "TimeLock"
  );
  const timelock = (await upgrades.deployProxy(
    timeLockFactory,
    [VOTING_DELAY, [], [], await owner.getAddress()],
    { initializer: "initialize", kind: "transparent" }
  )) as TimeLock;
  await timelock.deployed();

  const governanceTokenFactory: ContractFactory =
    await ethers.getContractFactory("GovernanceToken", owner);
  const governanceToken = (await upgrades.deployProxy(
    governanceTokenFactory,
    [],
    { initializer: "initialize", kind: "transparent" }
  )) as GovernanceToken;
  await governanceToken.deployed();

  const organizationGovernanceFactory: ContractFactory =
    await ethers.getContractFactory("OrganizationGovernance");
  const organizationGovernance = (await upgrades.deployProxy(
    organizationGovernanceFactory,
    [
      governanceToken.address,
      membershipNFT.address,
      timelock.address,
      VOTING_PERIOD,
      QUORUM_PERCENTAGE,
      PROPOSAL_THRESHOLD,
    ],
    { initializer: "initialize", kind: "transparent" }
  )) as OrganizationGovernance;
  await organizationGovernance.deployed();

  const boxFactory = await hre.ethers.getContractFactory("Box", owner);
  const box = await upgrades.deployProxy(boxFactory, [timelock.address], {
    initializer: "initialize",
    kind: "transparent",
  });
  await box.deployed();

  return {
    membershipNFT,
    timelock,
    governanceToken,
    organizationGovernance,
    box,
  };
}

export async function setAdminsMembersAndVotingPower(
  membershipNFT: MembershipNFT,
  governanceToken: GovernanceToken,
  owner: Signer,
  address1: Signer,
  address2: Signer,
  address3: Signer
) {
  // Mint a membership token for the first users
  const tx1 = await membershipNFT
    .connect(owner)
    .mint(await address1.getAddress(), 0, 1, toUtf8Bytes(""));
  await tx1.wait();
  await governanceToken.connect(owner).mint(await address1.getAddress(), 1);
  const tx2 = await membershipNFT
    .connect(owner)
    .mint(await address2.getAddress(), 0, 1, toUtf8Bytes(""));
  await tx2.wait();
  await governanceToken.connect(owner).mint(await address2.getAddress(), 1);
  const tx3 = await membershipNFT
    .connect(owner)
    .mint(await owner.getAddress(), 0, 1, toUtf8Bytes(""));
  await tx3.wait();
  await governanceToken.connect(owner).mint(await address3.getAddress(), 1);
}

describe("OrganizationGovernance", () => {
  const initialSupply = 20;

  let owner: Signer;
  let address1: Signer;
  let address2: Signer;
  let address3: Signer;
  let signers: Signer[];

  let organizationGovernance: OrganizationGovernance;
  let membershipNFT: MembershipNFT;
  let timelock: TimeLock;
  let governanceToken: GovernanceToken;
  let box: any;

  let encodedFunctionCall: any;
  let targets: any[];
  let values: any[];
  let calldatas: any[];
  const description = "First proposal";
  const descriptionHash = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(description)
  );

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

    await setAdminsMembersAndVotingPower(
      membershipNFT,
      governanceToken,
      owner,
      address1,
      address2,
      address3
    );

    encodedFunctionCall = box.interface.encodeFunctionData(STORE_FUNC, [
      STORE_VALUE,
    ]);

    // Make the member a valid member (has a non-zero balance of membership tokens)
    // Mock the IERC1155 contract to return a non-zero balance for the member

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
    // const revokeTx = await timelock.revokeRole(adminRole, this.address);
    // await revokeTx.wait(1);
  });

  it("should create a sub DAO project correctly", async () => {
    // const [admin] = await ethers.getSigners();

    await organizationGovernance
      .connect(owner)
      .createSubDaoProject(address1.getAddress());
    const subDAO = await organizationGovernance.subDAO(0);

    expect(subDAO).to.equal(await address1.getAddress());
  });

  it("should not allow a non-member to propose", async () => {
    // expect the function to throw an error
    await expect(
      organizationGovernance
        .connect(address3)
        .propose(targets, values, calldatas, description, {
          gasLimit: 250000,
        })
    ).to.be.revertedWith("OrganizationGovernance::membersOnly: not a member");
  });

  it("should be able to vote only once per a proposal", async () => {
    const { proposalId, proposalSnapshot } = await makeProposal(
      encodedFunctionCall,
      targets,
      values,
      organizationGovernance,
      address1,
      calldatas,
      description
    );
    const tx1 = await governanceToken
      .connect(owner)
      .mint(await address1.getAddress(), 1);
    console.log(
      `Voting power for member 1: ${await governanceToken.getVotes(
        await address1.getAddress()
      )}`
    );
    await expect(await organizationGovernance.state(proposalId)).to.equal(1);
    const voteTx1 = await organizationGovernance
      .connect(address1)
      ["castVote(uint256,uint8,string)"](proposalId, 0, VOTING_REASON_EXAMPLE);
    await voteTx1.wait(1);
    expect(voteTx1)
      .to.emit(organizationGovernance, "VoteCast")
      .withArgs(
        await address1.getAddress(),
        proposalId,
        0,
        1,
        VOTING_REASON_EXAMPLE
      );
    expect(
      organizationGovernance
        .connect(address1)
        ["castVote(uint256,uint8)"](proposalId, 1)
    ).to.be.revertedWith(
      "OrganizationGovernance: you can vote only once in a voting period"
    );
    const proposalFinal = await organizationGovernance.proposals(proposalId);
    expect(await proposalFinal.votes).to.equal(1);
  });

  it("should allow only owner to set new proposal threshold", async () => {
    await expect(
      organizationGovernance.connect(address1).setProposalThreshold(2)
    ).to.be.revertedWith(
      "OrganizationGovernance::daoOwnerOnly: not a dao call"
    );
    await organizationGovernance.setProposalThreshold(2);
    expect(await organizationGovernance.proposalThreshold()).to.equal(2);
  });

  it("should allow a member to propose and members to vote on proposal", async () => {
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

    // expect(await organizationGovernance.connect(address1).connect(address1)["castVote(uint256,uint8,uint256)"](proposalId, 0, 2)).to.be.revertedWith("OrganizationGovernance: You need at least as many tokens as you want to vote with.");
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
    const queueTx = await organizationGovernance
      .connect(owner)
      .queue([box.address], [0], [encodedFunctionCall], descriptionHash);
    await queueTx.wait(1);

    if (developmentChains.includes(network.name)) {
      await moveTime(MIN_DELAY + 1);
      await moveBlocks(1);
    }

    console.log("Executing");
    const executeTx = await organizationGovernance
      .connect(owner)
      .execute([box.address], [0], [encodedFunctionCall], descriptionHash);
    await executeTx.wait(1);

    const boxNewValue = await box.retrieve();
    console.log(`New Box Value: ${boxNewValue.toString()}`);
  });
});
