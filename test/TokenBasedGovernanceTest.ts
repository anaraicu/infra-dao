import { ethers, network, upgrades } from "hardhat";
import { expect } from "chai";
import { ContractFactory, Signer } from "ethers";
import { solidity } from "ethereum-waffle";
import {
  MembershipNFT,
  OrganizationGovernance,
  GovernanceToken,
  TimeLock,
  TokenBasedGovernance,
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

describe("TokenBasedGovernance", () => {
  const initialSupply = 20;

  let owner: Signer;
  let address1: Signer;
  let address2: Signer;
  let address3: Signer;
  let signers: Signer[];

  let tokenBasedGovernance: TokenBasedGovernance;
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

    const tokenBasedGovernanceFactory: ContractFactory =
      await ethers.getContractFactory("TokenBasedGovernance");
    tokenBasedGovernance = (await upgrades.deployProxy(
      tokenBasedGovernanceFactory,
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
    )) as TokenBasedGovernance;
    await tokenBasedGovernance.deployed();

    await tokenBasedGovernance.setAdmin(owner.getAddress());
    await tokenBasedGovernance.setAdmin(address1.getAddress());
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
      tokenBasedGovernance.address
    );
    await proposerTx.wait(1);
    const executorTx = await timelock.grantRole(
      executorRole,
      tokenBasedGovernance.address
    );
    await executorTx.wait(1);
  });

  it("should set the initial values correctly", async () => {
    const votingPeriod = await tokenBasedGovernance.votingPeriod();
    const quorumPercentage = await tokenBasedGovernance.getQuorumNumerator();
    const proposalThreshold = await tokenBasedGovernance.proposalThreshold();
    const organization = await tokenBasedGovernance.organizationAddress();

    expect(votingPeriod).to.equal(VOTING_PERIOD);
    expect(quorumPercentage).to.equal(QUORUM_PERCENTAGE);
    expect(proposalThreshold).to.equal(PROPOSAL_THRESHOLD);
    expect(organization).to.equal(organizationGovernance.address);
  });

  it("should set the batch admins correctly", async () => {
    await tokenBasedGovernance
      .connect(owner)
      .setAdmins([owner.getAddress(), address1.getAddress()]);
    const isAdminOwner = await tokenBasedGovernance.isAdmin(owner.getAddress());
    const isAdminAddress1 = await tokenBasedGovernance.isAdmin(
      address1.getAddress()
    );

    expect(isAdminOwner).to.be.true;
    expect(isAdminAddress1).to.be.true;
    // expect the function to throw an error
    await expect(
      tokenBasedGovernance.connect(address1).setAdmin(owner.getAddress())
    ).to.be.revertedWith(
      "TokenBasedGovernance::organizationOnly: not the owner or the organization"
    );
  });

  it("should set/remove admin correctly", async () => {
    const [admin] = await ethers.getSigners();

    await tokenBasedGovernance.setAdmin(admin.address);
    await tokenBasedGovernance.removeAdmin(admin.address);
    const isAdmin = await tokenBasedGovernance.isAdmin(admin.address);

    expect(isAdmin).to.be.false;
  });

  it("should add subDAO to organization DAO", async () => {
    await organizationGovernance
      .connect(owner)
      .createSubDaoProject(tokenBasedGovernance.address);
    const subDAO = await organizationGovernance.subDAO(0);

    expect(subDAO).to.equal(tokenBasedGovernance.address);
  });

  it("should not allow a non-member to propose", async () => {
    // expect the function to throw an error
    await expect(
      tokenBasedGovernance
        .connect(address3)
        .propose(targets, values, calldatas, description, {
          gasLimit: 250000,
        })
    ).to.be.revertedWith("TokenBasedGovernance::membersOnly: not a member");
  });

  it("should allow a member to propose and members to vote on proposal", async () => {
    await governanceToken.connect(address3).delegate(address1.getAddress());
    const { proposalId, proposalSnapshot } = await makeProposal(
      encodedFunctionCall,
      targets,
      values,
      tokenBasedGovernance,
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

    expect(await tokenBasedGovernance.state(proposalId)).to.equal(1);
    // expect(await governance.connect(address1).connect(address1)["castVote(uint256,uint8,uint256)"](proposalId, 0, 2)).to.be.revertedWith("OrganizationGovernance: You need at least as many tokens as you want to vote with.");
    const voteTx1 = await tokenBasedGovernance
      .connect(address1)
      ["castVote(uint256,uint8,string)"](proposalId, 1, VOTING_REASON_EXAMPLE, {
        value: ethers.utils.parseUnits("0.03", "ether"),
        gasLimit: 250000,
      });
    await voteTx1.wait(1);
    expect(voteTx1)
      .to.emit(tokenBasedGovernance, "VoteCast")
      .withArgs(
        await address1.getAddress(),
        proposalId,
        1,
        2,
        VOTING_REASON_EXAMPLE
      );
    const voteTx2 = await tokenBasedGovernance
      .connect(address2)
      ["castVote(uint256,uint8)"](proposalId, 1);
    await voteTx2.wait(1);
    expect(voteTx2)
      .to.emit(tokenBasedGovernance, "VoteCast")
      .withArgs(await address2.getAddress(), proposalId, 1, 1, "");

    expect(
      tokenBasedGovernance
        .connect(address3)
        ["castVote(uint256,uint8)"](proposalId, 1)
    ).to.be.revertedWith("TokenBasedGovernance::membersOnly: not a member");
    // VOTING POWER implementation

    if (developmentChains.includes(network.name)) {
      await moveBlocks(VOTING_PERIOD + 1);
    }
    const votingResult = await tokenBasedGovernance.proposalVotes(proposalId);
    console.log(`Voting result: ${votingResult}`);
    console.log(
      `Quorum: ${await tokenBasedGovernance.quorum(proposalSnapshot)}`
    );
    expect(await tokenBasedGovernance.state(proposalId)).to.equal(4);
    const proposalFinal = await tokenBasedGovernance.proposals(proposalId);
    expect(await proposalFinal.votes).to.equal(3);

    console.log("Queueing...");

    const queueTx = await tokenBasedGovernance
      .connect(owner)
      .queue([box.address], [0], [encodedFunctionCall], descriptionHash);
    await queueTx.wait(1);

    if (developmentChains.includes(network.name)) {
      await moveTime(MIN_DELAY + 1);
      await moveBlocks(1);
    }

    console.log("Executing");
    const executeTx = await tokenBasedGovernance
      .connect(owner)
      .execute([box.address], [0], [encodedFunctionCall], descriptionHash);
    await executeTx.wait(1);

    const boxNewValue = await box.retrieve();
    console.log(`New Box Value: ${boxNewValue.toString()}`);
    expect(await tokenBasedGovernance.allProposalsFinished()).to.be.true;
  });

  it("should transfer funds to org dao on close", async () => {
    const initialBalance = ethers.utils.parseEther("5");
    const ownerAddress = await owner.getAddress();
    await ethers.provider.send("hardhat_impersonateAccount", [ownerAddress]);
    await ethers.provider.send("hardhat_setBalance", [
      ownerAddress,
      initialBalance.toHexString(),
    ]);
    expect(await ethers.provider.getBalance(ownerAddress)).to.equal(
      initialBalance
    );

    const funds = ethers.utils.parseEther("1");
    console.log(`Sending ${funds} to governance`);
    await owner.sendTransaction({
      to: tokenBasedGovernance.address,
      value: funds.toHexString(),
    });

    expect(await ethers.provider.getBalance(ownerAddress)).to.be.closeTo(
      initialBalance.sub(ethers.utils.parseEther("1")),
      ethers.utils.parseEther("0.1")
    );
    expect(await tokenBasedGovernance.getBalance()).to.equal(
      ethers.utils.parseEther("1")
    );
    expect(await organizationGovernance.getBalance()).to.equal(0);

    console.log(`Closing gov dao`);
    const closeTx = await tokenBasedGovernance.connect(owner).closeDAO();
    await closeTx.wait(1);
    expect(await tokenBasedGovernance.getBalance()).to.equal(0);
    expect(await organizationGovernance.getBalance()).to.equal(funds);
  });
});
