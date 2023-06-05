import { ethers, network, upgrades } from "hardhat";
import { expect } from "chai";
import { ContractFactory, Signer } from "ethers";
import { solidity } from "ethereum-waffle";
import {
  MembershipNFT,
  OrganizationGovernance,
  GovernanceToken,
  TimeLock,
  QuadraticGovernance,
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
  makeProposal,
  setAdminsMembersAndVotingPower,
} from "./OrganizationGovernanceTest";

const chai = require("chai");
chai.use(solidity);

describe("QuadraticGovernance", () => {
  const initialSupply = 20;

  let owner: Signer;
  let address1: Signer;
  let address2: Signer;
  let address3: Signer;
  let signers: Signer[];

  let quadraticGovernance: QuadraticGovernance;
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

    const quadraticGovernanceFactory: ContractFactory =
      await ethers.getContractFactory("QuadraticGovernance");
    quadraticGovernance = (await upgrades.deployProxy(
      quadraticGovernanceFactory,
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
    )) as QuadraticGovernance;
    await quadraticGovernance.deployed();

    await quadraticGovernance.setAdmin(owner.getAddress());
    await quadraticGovernance.setAdmin(address1.getAddress());
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
      quadraticGovernance.address
    );
    await proposerTx.wait(1);
    const executorTx = await timelock.grantRole(
      executorRole,
      quadraticGovernance.address
    );
    await executorTx.wait(1);
    // const revokeTx = await timelock.revokeRole(adminRole, this.address);
    // await revokeTx.wait(1);
  });

  it("should be able to setMinQudraticThreshold", async () => {
    expect(await quadraticGovernance.minQuadraticVoteThreshold()).to.equal(1);
    await quadraticGovernance.connect(owner).setMinQuadraticVoteThreshold(2);
    expect(await quadraticGovernance.minQuadraticVoteThreshold()).to.equal(2);

    expect(
      quadraticGovernance.connect(address1).setMinQuadraticVoteThreshold(3)
    ).to.be.revertedWith(
      "Governance::organizationOnly: not the owner or the organization"
    );
  });

  it("should allow a member to propose and members to vote on proposal", async () => {
    await governanceToken.connect(owner).mint(await address1.getAddress(), 3);
    const { proposalId, proposalSnapshot } = await makeProposal(
      encodedFunctionCall,
      targets,
      values,
      quadraticGovernance,
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
    await governanceToken
      .connect(address1)
      .approve(quadraticGovernance.address, 10);
    await governanceToken
      .connect(address2)
      .approve(quadraticGovernance.address, 10);

    // expect(await tokenBasedGovernance.connect(address1).connect(address1)["castVote(uint256,uint8,uint256)"](proposalId, 0, 2)).to.be.revertedWith("OrganizationGovernance: You need at least as many tokens as you want to vote with.");
    const voteTx1 = await quadraticGovernance
      .connect(address1)
      ["castVote(uint256,uint8,uint256,string)"](
        proposalId,
        1,
        2,
        VOTING_REASON_EXAMPLE,
        {
          value: ethers.utils.parseUnits("0.03", "ether"),
          gasLimit: 250000,
        }
      );
    await voteTx1.wait(1);
    expect(voteTx1)
      .to.emit(quadraticGovernance, "VoteCast")
      .withArgs(
        await address1.getAddress(),
        proposalId,
        1,
        2,
        VOTING_REASON_EXAMPLE
      );
    expect(await quadraticGovernance.getBalance()).to.equal(
      ethers.utils.parseEther("0.03")
    );
    console.log("Address 1 voted");

    const voteTx2 = await quadraticGovernance
      .connect(address2)
      ["castVote(uint256,uint8)"](proposalId, 0);
    await voteTx2.wait(1);
    expect(voteTx2)
      .to.emit(quadraticGovernance, "VoteCast")
      .withArgs(await address2.getAddress(), proposalId, 0, 1, "");
    expect(await quadraticGovernance.getBalance()).to.equal(
      ethers.utils.parseEther("0.03")
    );
    console.log("Address 2 voted");

    expect(
      quadraticGovernance
        .connect(address3)
        ["castVote(uint256,uint8)"](proposalId, 0)
    ).to.be.revertedWith("Governance::membersOnly: not a member");
    // VOTING POWER implementation

    if (developmentChains.includes(network.name)) {
      await moveBlocks(VOTING_PERIOD + 1);
    }
    const votingResult = await quadraticGovernance.proposalVotes(proposalId);
    console.log(`Voting result: ${votingResult}`);
    console.log(
      `Quorum: ${await quadraticGovernance.quorum(proposalSnapshot)}`
    );
    expect(await quadraticGovernance.state(proposalId)).to.equal(4);
    const proposalFinal = await quadraticGovernance.proposals(proposalId);
    expect(await proposalFinal.votes).to.equal(3);
    expect(await proposalFinal.budget)
      .to.equal(await quadraticGovernance.getBalance())
      .to.equal(ethers.utils.parseEther("0.03"));

    console.log("Queueing...");

    const queueTx = await quadraticGovernance
      .connect(owner)
      .queue([box.address], [0], [encodedFunctionCall], descriptionHash);
    await queueTx.wait(1);

    if (developmentChains.includes(network.name)) {
      await moveTime(MIN_DELAY + 1);
      await moveBlocks(1);
    }

    console.log("Executing");
    const executeTx = await quadraticGovernance
      .connect(owner)
      .execute([box.address], [0], [encodedFunctionCall], descriptionHash);
    await executeTx.wait(1);

    const boxNewValue = await box.retrieve();
    console.log(`New Box Value: ${boxNewValue.toString()}`);
  });
});
