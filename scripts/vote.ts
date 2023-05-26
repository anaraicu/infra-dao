import * as fs from "fs";
import {
  VOTING_PERIOD,
  deploymentsFile,
  developmentChains,
  proposalsFile,
} from "../helper-config";
import { network, ethers } from "hardhat";
import { moveBlocks } from "../utils/move-blocks";
import { toUtf8Bytes } from "ethers/lib/utils";
import {
  GovernanceToken,
  MembershipNFT,
  OrganizationGovernance,
} from "../typechain-types";

async function voteOnLast() {
  const [deployer, member] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const memberAddress = await member.getAddress();

  const content = fs.readFileSync(deploymentsFile, "utf8");
  const data = JSON.parse(content);

  const proposals = JSON.parse(fs.readFileSync(proposalsFile, "utf8"));
  const lastIndex = proposals[network.config.chainId!].length - 1;
  const proposalId = proposals[network.config.chainId!][lastIndex];
  // 0 == against
  // 1 == for
  // 2 == Abstain - usually costs gas so just don't vote
  const voteType = 1;
  const governor = (await ethers.getContractAt(
    "OrganizationGovernance",
    data.organizationGovernance
  )) as OrganizationGovernance;

  const reason = "I like this proposal";
  const voteTxResponse = await governor
    .connect(member)
    ["castVote(uint256,uint8,string)"](proposalId, voteType, reason);

  await voteTxResponse.wait(1);
  if (developmentChains.includes(network.name)) {
    await moveBlocks(VOTING_PERIOD);
  }
  console.log("Voted! Ready to go!");
  console.log(`Proposal ${proposalId} voted on`);
  console.log(`Governor voting period ${await governor.votingPeriod()}`);
  console.log(`Governor voting period should be ${VOTING_PERIOD}`);
  // console.log(`Governor quorum percentage ${await governor.quorumNumerator()}`)
  console.log("Proposal state is: " + (await governor.state(proposalId)));
  // and then check the state of the vote
  // yarn hardhat console --network localhost

  //     Type ".help" for more information.
  //     >  const governor = await ethers.getContract("Governance")
  //     undefined
  //     > await governor.state("<proposal hash in proposals.json>")
  //     4
  //     > 4 == SUCCEEDED IN open zeppelin/contracts/governance/IGovernor.sol
}

voteOnLast()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
