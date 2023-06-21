import { ethers, network, upgrades } from "hardhat";
import { expect } from "chai";
import { ContractFactory, Signer } from "ethers";
import { solidity } from "ethereum-waffle";
import {
  MembershipNFT,
  OrganizationGovernance,
  GovernanceToken,
  TimeLock,
  WeightedGovernance,
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

describe("WeightedGovernance", () => {
  const initialSupply = 20;

  let owner: Signer;
  let address1: Signer;
  let address2: Signer;
  let address3: Signer;
  let signers: Signer[];

  let weightedGovernance: WeightedGovernance;
  let membershipNFT: MembershipNFT;
  let timelock: TimeLock;
  let governanceToken: GovernanceToken;
  let box: any;
  let organizationGovernance: OrganizationGovernance;

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

    const weightedGovernanceFactory: ContractFactory =
      await ethers.getContractFactory("WeightedGovernance");
    weightedGovernance = (await upgrades.deployProxy(
      weightedGovernanceFactory,
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
    )) as WeightedGovernance;
    await weightedGovernance.deployed();

    await weightedGovernance.setAdmin(owner.getAddress());
    await weightedGovernance.setAdmin(address1.getAddress());
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
    const adminRole = await timelock.DEFAULT_ADMIN_ROLE();

    const proposerTx = await timelock.grantRole(
      proposerRole,
      weightedGovernance.address
    );
    await proposerTx.wait(1);
    const executorTx = await timelock.grantRole(
      executorRole,
      weightedGovernance.address
    );
    await executorTx.wait(1);
    // const revokeTx = await timelock.revokeRole(adminRole, this.address);
    // await revokeTx.wait(1);
  });

  it("should allow a member to propose and members to vote on proposal", async () => {
    await governanceToken.connect(owner).mint(await address1.getAddress(), 2);
    const { proposalId, proposalSnapshot } = await makeProposal(
      encodedFunctionCall,
      targets,
      values,
      weightedGovernance,
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
      .approve(weightedGovernance.address, 10);
    await governanceToken
      .connect(address2)
      .approve(weightedGovernance.address, 10);

    const voteTx1 = await weightedGovernance
      .connect(address1)
      ["castVote(uint256,uint8,uint256,string)"](
        proposalId,
        1,
        2,
        VOTING_REASON_EXAMPLE,
        {
          value: ethers.utils.parseUnits("0.0002", "ether"),
          gasLimit: 250000,
        }
      );
    await voteTx1.wait(1);
    expect(voteTx1)
      .to.emit(weightedGovernance, "VoteCast")
      .withArgs(
        await address1.getAddress(),
        proposalId,
        1,
        2,
        VOTING_REASON_EXAMPLE
      );
    console.log("Address 1 voted");

    const voteTx2 = await weightedGovernance
      .connect(address2)
      ["castVote(uint256,uint8)"](proposalId, 0);
    await voteTx2.wait(1);
    expect(voteTx2)
      .to.emit(weightedGovernance, "VoteCast")
      .withArgs(await address2.getAddress(), proposalId, 0, 1, "");
    console.log("Address 2 voted");

    expect(
      weightedGovernance
        .connect(address3)
        ["castVote(uint256,uint8,uint256,string)"](proposalId, 0, 1, "")
    ).to.be.revertedWith("TokenBasedGovernance::membersOnly: not a member");
    // VOTING POWER implementation

    if (developmentChains.includes(network.name)) {
      await moveBlocks(VOTING_PERIOD + 1);
    }
    const votingResult = await weightedGovernance.proposalVotes(proposalId);
    console.log(`Voting result: ${votingResult}`);
    console.log(`Quorum: ${await weightedGovernance.quorum(proposalSnapshot)}`);
    expect(await weightedGovernance.state(proposalId)).to.equal(4);
    const proposalFinal = await weightedGovernance.proposals(proposalId);
    expect(await proposalFinal.votes).to.equal(3);
    expect(await proposalFinal.budget).to.equal(
      ethers.utils.parseUnits("0.0002", "ether")
    );
    console.log("Queueing...");

    const queueTx = await weightedGovernance
      .connect(owner)
      .queue([box.address], [0], [encodedFunctionCall], descriptionHash);
    await queueTx.wait(1);

    if (developmentChains.includes(network.name)) {
      await moveTime(MIN_DELAY + 1);
      await moveBlocks(1);
    }

    console.log("Executing");
    const executeTx = await weightedGovernance
      .connect(owner)
      .execute([box.address], [0], [encodedFunctionCall], descriptionHash);
    await executeTx.wait(1);

    const boxNewValue = await box.retrieve();
    console.log(`New Box Value: ${boxNewValue.toString()}`);

    const withdrawTx = await weightedGovernance.connect(owner).closeDAO();
    await withdrawTx.wait(1);
  });
});
