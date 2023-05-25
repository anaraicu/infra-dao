import { ethers, network, upgrades } from "hardhat";
import { expect } from "chai";
import { ContractFactory, Signer } from "ethers";
import { solidity } from "ethereum-waffle";
import {
  MembershipNFT,
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
  VOTING_PERIOD,
  VOTING_REASON_EXAMPLE,
} from "../helper-config";
import { moveBlocks } from "../utils/move-blocks";
import { moveTime } from "../utils/move-time";
import {
  getTokenAndGovernanceContracts,
  setAdminsMembersAndVotingPower,
  makeProposal,
} from "./OrganizationGovernanceTest";

const chai = require("chai");
chai.use(solidity);
const hre = require("hardhat");

describe("Governance", () => {
  const initialSupply = 20;

  let owner: Signer;
  let address1: Signer;
  let address2: Signer;
  let address3: Signer;
  let signers: Signer[];

  let governance: Governance;
  let membershipNFT: MembershipNFT;
  let timelock: TimeLock;
  let governanceToken: GovernanceToken;
  let organizationGovernance: OrganizationGovernance;
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

    const governanceFactory: ContractFactory = await ethers.getContractFactory(
      "Governance"
    );
    governance = (await upgrades.deployProxy(
      governanceFactory,
      [
        governanceToken.address,
        membershipNFT.address,
        timelock.address,
        VOTING_PERIOD,
        QUORUM_PERCENTAGE,
        PROPOSAL_THRESHOLD,
        organizationGovernance.address,
      ],
      { initializer: "initialize" }
    )) as Governance;
    await governance.deployed();

    await governance.setAdmin(owner.getAddress());
    await governance.setAdmin(address1.getAddress());
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

    // Propose a new proposal
    targets = [box.address]; // Add target addresses
    values = [0]; // Add values
    calldatas = [encodedFunctionCall]; // Add calldatas

    const proposerRole = await timelock.PROPOSER_ROLE();
    const executorRole = await timelock.EXECUTOR_ROLE();

    const proposerTx = await timelock.grantRole(
      proposerRole,
      governance.address
    );
    await proposerTx.wait(1);
    const executorTx = await timelock.grantRole(
      executorRole,
      governance.address
    );
    await executorTx.wait(1);
  });

  it("should set the initial values correctly", async () => {
    const votingPeriod = await governance.votingPeriod();
    const quorumPercentage = await governance.getQuorumNumerator();
    const proposalThreshold = await governance.proposalThreshold();
    const organization = await governance.organizationAddress();

    expect(votingPeriod).to.equal(VOTING_PERIOD);
    expect(quorumPercentage).to.equal(QUORUM_PERCENTAGE);
    expect(proposalThreshold).to.equal(PROPOSAL_THRESHOLD);
    expect(organization).to.equal(organizationGovernance.address);
  });

  it("should set the batch admins correctly", async () => {
    await governance
      .connect(owner)
      .setAdmins([owner.getAddress(), address1.getAddress()]);
    const isAdminOwner = await governance.isAdmin(owner.getAddress());
    const isAdminAddress1 = await governance.isAdmin(address1.getAddress());

    expect(isAdminOwner).to.be.true;
    expect(isAdminAddress1).to.be.true;
    // expect the function to throw an error
    await expect(
      governance.connect(address1).setAdmin(owner.getAddress())
    ).to.be.revertedWith(
      "Governance::organizationOnly: not the owner or the organization"
    );
  });

  it("should set/remove admin correctly", async () => {
    const [admin] = await ethers.getSigners();

    await governance.setAdmin(admin.address);
    await governance.removeAdmin(admin.address);
    const isAdmin = await governance.isAdmin(admin.address);

    expect(isAdmin).to.be.false;
  });

  it("should add subDAO to organization DAO", async () => {
    await organizationGovernance
      .connect(owner)
      .createSubDaoProject(governance.address);
    const subDAO = await organizationGovernance.subDAO(0);

    expect(subDAO).to.equal(governance.address);
  });

  it("should not allow a non-member to propose", async () => {
    // expect the function to throw an error
    await expect(
      governance
        .connect(address3)
        .propose(targets, values, calldatas, description, {
          gasLimit: 250000,
        })
    ).to.be.revertedWith("Governance::membersOnly: not a member");
  });

  it("should allow a member to propose and members to vote on proposal", async () => {
    await governanceToken.connect(address3).delegate(address1.getAddress());
    const { proposalId, proposalSnapshot } = await makeProposal(
      encodedFunctionCall,
      targets,
      values,
      governance,
      address1,
      calldatas,
      description
    );
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

    expect(await governance.state(proposalId)).to.equal(1);
    // expect(await governance.connect(address1).connect(address1)["castVote(uint256,uint8,uint256)"](proposalId, 0, 2)).to.be.revertedWith("OrganizationGovernance: You need at least as many tokens as you want to vote with.");
    const voteTx1 = await governance
      .connect(address1)
      ["castVote(uint256,uint8,string)"](proposalId, 1, VOTING_REASON_EXAMPLE, {
        value: ethers.utils.parseUnits("0.03", "ether"),
        gasLimit: 250000,
      });
    await voteTx1.wait(1);
    expect(voteTx1)
      .to.emit(governance, "VoteCast")
      .withArgs(
        await address1.getAddress(),
        proposalId,
        1,
        2,
        VOTING_REASON_EXAMPLE
      );
    const voteTx2 = await governance
      .connect(address2)
      ["castVote(uint256,uint8)"](proposalId, 1);
    await voteTx2.wait(1);
    expect(voteTx2)
      .to.emit(governance, "VoteCast")
      .withArgs(await address2.getAddress(), proposalId, 1, 1, "");

    expect(
      governance.connect(address3)["castVote(uint256,uint8)"](proposalId, 1)
    ).to.be.revertedWith("Governance::membersOnly: not a member");
    // VOTING POWER implementation

    if (developmentChains.includes(network.name)) {
      await moveBlocks(VOTING_PERIOD + 1);
    }
    const votingResult = await governance.proposalVotes(proposalId);
    console.log(`Voting result: ${votingResult}`);
    console.log(`Quorum: ${await governance.quorum(proposalSnapshot)}`);
    expect(await governance.state(proposalId)).to.equal(4);
    const proposalFinal = await governance.proposals(proposalId);
    expect(await proposalFinal.votes).to.equal(3);

    console.log("Queueing...");

    const queueTx = await governance
      .connect(owner)
      .queue([box.address], [0], [encodedFunctionCall], descriptionHash);
    await queueTx.wait(1);

    if (developmentChains.includes(network.name)) {
      await moveTime(MIN_DELAY + 1);
      await moveBlocks(1);
    }

    console.log("Executing");
    const executeTx = await governance
      .connect(owner)
      .execute([box.address], [0], [encodedFunctionCall], descriptionHash);
    await executeTx.wait(1);

    const boxNewValue = await box.retrieve();
    console.log(`New Box Value: ${boxNewValue.toString()}`);
    expect(await governance.allProposalsFinished()).to.be.true;
  });

  it("should not execute proposals where current VPs no longer correspond", async () => {
    await governanceToken.connect(owner).mint(await address1.getAddress(), 10);
    const { proposalId, proposalSnapshot } = await makeProposal(
      encodedFunctionCall,
      targets,
      values,
      governance,
      address1,
      calldatas,
      description
    );
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

    const voteTx1 = await governance
      .connect(address1)
      ["castVote(uint256,uint8,string)"](proposalId, 1, VOTING_REASON_EXAMPLE, {
        value: ethers.utils.parseUnits("0.03", "ether"),
        gasLimit: 250000,
      });
    await voteTx1.wait(1);
    expect(voteTx1)
      .to.emit(governance, "VoteCast")
      .withArgs(
        await address1.getAddress(),
        proposalId,
        1,
        11,
        VOTING_REASON_EXAMPLE
      );
    const voteTx2 = await governance
      .connect(address2)
      ["castVote(uint256,uint8)"](proposalId, 1);
    await voteTx2.wait(1);
    expect(voteTx2)
      .to.emit(governance, "VoteCast")
      .withArgs(await address2.getAddress(), proposalId, 1, 1, "");
    await governanceToken
      .connect(address1)
      .transfer(await address2.getAddress(), 10);

    if (developmentChains.includes(network.name)) {
      await moveBlocks(VOTING_PERIOD + 1);
    }
    const votingResult = await governance.proposalVotes(proposalId);
    console.log(`Voting result: ${votingResult}`);
    console.log(`Quorum: ${await governance.quorum(proposalSnapshot)}`);
    expect(await governance.state(proposalId)).to.equal(4);
    const proposalFinal = await governance.proposals(proposalId);
    expect(await proposalFinal.votes).to.equal(12);

    console.log("Queueing...");

    const queueTx = await governance
      .connect(owner)
      .queue([box.address], [0], [encodedFunctionCall], descriptionHash);
    await queueTx.wait(1);

    if (developmentChains.includes(network.name)) {
      await moveTime(MIN_DELAY + 1);
      await moveBlocks(1);
    }

    console.log("Executing");
    expect(
      governance
        .connect(owner)
        .execute([box.address], [0], [encodedFunctionCall], descriptionHash)
    ).to.be.revertedWith(
      "Governance::execute: voter no longer has the casted VP."
    );
  });

  it("should transfer funds to org dao on close", async () => {
    const provider = ethers.provider;
    await governance.receiveETH({ value: ethers.utils.parseEther("1") });
    const balance = await provider.getBalance(governance.address);
    console.log(
      "Prior to execute Balance: ",
      ethers.utils.formatEther(balance)
    );

    expect(await governance.getBalance()).to.equal(
      ethers.utils.parseEther("1")
    );
    expect(await organizationGovernance.getBalance()).to.equal(0);

    const closeTx = await governance.connect(owner).closeDAO();
    await closeTx.wait(1);
    //
    // expect(await governance.getBalance()).to.equal(0);
    // expect(await organizationGovernance.getBalance()).to.equal(1);

    // TODO: fix this test
  });
});
