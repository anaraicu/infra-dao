import * as fs from "fs";
import {
  DEFAULT_VOTING_PERIOD,
  developmentChains,
  proposalsFile,
  VOTING_DELAY,
  VOTING_PERIOD,
} from "../helper-config";
import { network, ethers } from "hardhat";
import { moveBlocks } from "../utils/move-blocks";

const index = 0;

async function vote(proposalIndex: number) {
  const proposals = JSON.parse(fs.readFileSync(proposalsFile, "utf8"));
  const proposalId = proposals[network.config.chainId!][proposalIndex];
  // 0 == against
  // 1 == for
  // 2 == Abstain - usually costs gas so just don't vote
  const voteType = 1;
  const governor = await ethers.getContract("OrganizationGovernance");
  const reason = "I like this proposal";
  const voteTxResponse = await governor.castVoteWithReason(
    proposalId,
    voteType,
    reason
  );

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

vote(index)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
