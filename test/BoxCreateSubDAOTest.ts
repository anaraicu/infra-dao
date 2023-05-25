import { ethers, network, upgrades } from "hardhat";
import { BigNumber, Signer } from "ethers";
import { expect } from "chai";
import {
  Governance,
  GovernanceToken,
  MembershipNFT,
  OrganizationGovernance,
  TimeLock,
} from "../typechain-types";
import { solidity } from "ethereum-waffle";
import {
  getTokenAndGovernanceContracts,
  makeProposal,
  setAdminsMembersAndVotingPower,
} from "./OrganizationGovernanceTest";
import {
  Governance__factory,
  QuadraticGovernance__factory,
  TokenBasedGovernance__factory,
  MultiSigGovernance__factory,
} from "../typechain-types";
import { keccak256 } from "ethers/lib/utils";
import {
  developmentChains,
  MIN_DELAY,
  STORE_FUNC,
  STORE_VALUE,
  VOTING_PERIOD,
  VOTING_REASON_EXAMPLE,
} from "../helper-config";
import { moveBlocks } from "../utils/move-blocks";
import { moveTime } from "../utils/move-time";

const chai = require("chai");
chai.use(solidity);
const hre = require("hardhat");

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

  it("should deploy new subDAO with a new implementation using clones", async function () {
    const description =
      "Deploy new subDAO with simple governance implementation";
    const descriptionHash = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(description)
    );
    const implementations = [
      { name: "simple", factory: Governance__factory },
      { name: "quadratic", factory: QuadraticGovernance__factory },
      { name: "tokenBased", factory: TokenBasedGovernance__factory },
      { name: "multiSig", factory: MultiSigGovernance__factory },
    ];

    for (const { name, factory } of implementations) {
      const governanceFactory = new factory(owner);
      const governance = await governanceFactory.deploy();
      console.log(`${name} deployed at ${governance.address}`);
      const formattedName = ethers.utils.formatBytes32String(name);
      const tx = await box.registerSubDAO(formattedName, governance.address);
      await tx.wait();
    }

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

    console.log(`SubDAO deployed at ${await box.retrieveLastDeployed()}`);
  });
});
