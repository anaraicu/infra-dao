import { ethers, network, upgrades } from "hardhat";
import { expect } from "chai";
import { Contract, ContractFactory, Signer } from "ethers";
import { solidity } from "ethereum-waffle";
import {
  MembershipNFT,
  OrganizationGovernance,
  GovernanceToken,
  TimeLock,
  MultiSigGovernance,
} from "../typechain-types";
import {
  developmentChains,
  MIN_DELAY,
  PROPOSAL_THRESHOLD,
  QUORUM_PERCENTAGE,
  STORE_FUNC,
  STORE_VALUE,
  VOTING_PERIOD,
} from "../helper-config";
import { moveBlocks } from "../utils/move-blocks";
import { toUtf8Bytes } from "ethers/lib/utils";
import { moveTime } from "../utils/move-time";
import {
  getTokenAndGovernanceContracts,
  makeProposal,
  setAdminsMembersAndVotingPower,
} from "./OrganizationGovernanceTest";

const chai = require("chai");
chai.use(solidity);
const hre = require("hardhat");

describe("MultiSigGovernance", () => {
  const initialSupply = 20;

  let owner: Signer;
  let address1: Signer;
  let address2: Signer;
  let address3: Signer;
  let address4: Signer;
  let signers: Signer[];
  let multiSigners: string[];

  let multiSigGovernance: MultiSigGovernance;
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
    address4 = signers[4];

    const res = await getTokenAndGovernanceContracts(owner, initialSupply);
    membershipNFT = res.membershipNFT;
    timelock = res.timelock;
    governanceToken = res.governanceToken;
    organizationGovernance = res.organizationGovernance;
    box = res.box;

    const multiSigGovernanceFactory: ContractFactory =
      await ethers.getContractFactory("MultiSigGovernance");
    multiSigGovernance = (await upgrades.deployProxy(
      multiSigGovernanceFactory,
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
    )) as MultiSigGovernance;
    await multiSigGovernance.deployed();

    await multiSigGovernance.setAdmin(owner.getAddress());
    await multiSigGovernance.setAdmin(address1.getAddress());
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
      multiSigGovernance.address
    );
    await proposerTx.wait(1);
    const executorTx = await timelock.grantRole(
      executorRole,
      multiSigGovernance.address
    );
    await executorTx.wait(1);

    multiSigners = [await address1.getAddress(), await address2.getAddress()];
    await multiSigGovernance.setSigners(multiSigners);
    await multiSigGovernance.addSigner(await address4.getAddress());

    // Add new member with VP
    await membershipNFT.mint(
      await address4.getAddress(),
      0,
      1,
      toUtf8Bytes("")
    );
    await governanceToken.mint(await address4.getAddress(), 1);
  });

  it(`should be able to set required signatures correctly`, async () => {
    expect(await multiSigGovernance.requiredSignatures()).to.equal(4);
    const setRequiredSignaturesTx =
      await multiSigGovernance.setRequiredSignatures(3);
    expect(await multiSigGovernance.requiredSignatures()).to.equal(3);
  });

  it(`should be able to set signers correctly`, async () => {
    expect(await multiSigGovernance.getSignerAt(0)).to.equal(multiSigners[0]);
    expect(await multiSigGovernance.getSignerAt(1)).to.equal(multiSigners[1]);
  });

  it("should pass proposal if signers vote for", async () => {
    // Test with all addresses as members
    await multiSigGovernance.setRequiredSignatures(2);
    const { proposalId, proposalSnapshot } = await makeProposal(
      encodedFunctionCall,
      targets,
      values,
      multiSigGovernance,
      address1,
      calldatas,
      description
    );

    const voteTx1 = await multiSigGovernance
      .connect(address1)
      ["castVote(uint256,uint8)"](proposalId, 1);
    await voteTx1.wait(1);

    const voteTx2 = await multiSigGovernance
      .connect(address2)
      ["castVote(uint256,uint8)"](proposalId, 1);
    await voteTx2.wait(1);

    expect(
      multiSigGovernance
        .connect(address3)
        ["castVote(uint256,uint8)"](proposalId, 1)
    ).to.be.revertedWith("MultiSigGovernance::signersOnly: not a signer");
    // VOTING POWER implementation

    if (developmentChains.includes(network.name)) {
      await moveBlocks(VOTING_PERIOD + 1);
    }

    const proposalFinal = await multiSigGovernance.proposals(proposalId);
    expect(proposalFinal.votes).equal(2);
    expect(proposalFinal.budget).equal(0);
    expect(await multiSigGovernance.state(proposalId)).to.equal(4);

    console.log("Queueing...");
    const queueTx = await multiSigGovernance
      .connect(owner)
      .queue([box.address], [0], [encodedFunctionCall], descriptionHash);
    await queueTx.wait(1);

    if (developmentChains.includes(network.name)) {
      await moveTime(MIN_DELAY + 1);
      await moveBlocks(1);
    }

    console.log("Executing");
    const executeTx = await multiSigGovernance
      .connect(owner)
      .execute([box.address], [0], [encodedFunctionCall], descriptionHash);
    await executeTx.wait(1);
    const boxNewValue = await box.retrieve();
    console.log(`New Box Value: ${boxNewValue.toString()}`);
    expect(boxNewValue).to.equal(STORE_VALUE);
  });

  it("should not pass proposal if not enough signers vote", async () => {
    console.log(
      "Required signatures: ",
      await multiSigGovernance.requiredSignatures()
    );

    await multiSigGovernance.setRequiredSignatures(3);
    // Test with all addresses as members
    const { proposalId, proposalSnapshot } = await makeProposal(
      encodedFunctionCall,
      targets,
      values,
      multiSigGovernance,
      address1,
      calldatas,
      description
    );

    const voteTx1 = await multiSigGovernance
      .connect(address1)
      ["castVote(uint256,uint8)"](proposalId, 1);
    await voteTx1.wait(1);

    // address2 does not vote

    const voteTx2 = await multiSigGovernance
      .connect(address2)
      ["castVote(uint256,uint8)"](proposalId, 0);
    await voteTx2.wait(1);

    const voteTx4 = await multiSigGovernance
      .connect(address4)
      ["castVote(uint256,uint8)"](proposalId, 1);
    await voteTx4.wait(1);

    expect(
      multiSigGovernance
        .connect(address3)
        ["castVote(uint256,uint8)"](proposalId, 1)
    ).to.be.revertedWith("MultiSigGovernance::signersOnly: not a signer");
    // VOTING POWER implementation

    if (developmentChains.includes(network.name)) {
      await moveBlocks(VOTING_PERIOD + 1);
    }

    const proposalFinal = await multiSigGovernance.proposals(proposalId);
    expect(proposalFinal.votes).equal(3);
    expect(proposalFinal.budget).equal(0);
    expect(await multiSigGovernance.state(proposalId)).to.equal(4); // DEFEATED

    console.log("Queueing...");
    const queueTx = await multiSigGovernance
      .connect(owner)
      .queue([box.address], [0], [encodedFunctionCall], descriptionHash);
    await queueTx.wait(1);

    if (developmentChains.includes(network.name)) {
      await moveTime(MIN_DELAY + 1);
      await moveBlocks(1);
    }

    console.log("Executing... Should fail");
    expect(
      multiSigGovernance
        .connect(owner)
        .execute([box.address], [0], [encodedFunctionCall], descriptionHash)
    ).to.be.revertedWith("MultiSigGovernance: not enough signatures");
  });
});
