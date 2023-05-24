// This code is used to make an example proposal to the deployed DAO.
// It is not used in the tests.

import { ethers, network } from "hardhat";
import {
  PROPOSAL_DESCRIPTION_EXAMPLE,
  proposalsFile,
  VOTING_PERIOD,
  developmentChains,
  STORE_FUNC,
  STORE_VALUE,
  VOTING_DELAY,
} from "../helper-config";
import { moveBlocks } from "../utils/move-blocks";
import * as fs from "fs";

export async function propose(
  args: any[],
  functionToCall: string,
  proposalDescription: string
) {
  const governor = await ethers.getContractAt("OrganizationGovernance", "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318");
  const box = await ethers.getContractAt("Box", "0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE");

  const encodeFunctionCall = box.interface.encodeFunctionData(
    functionToCall,
    args
  );

  console.log(encodeFunctionCall);
  console.log(
    `Proposing ${functionToCall} with args ${args} on ${box.address}`
  );
  console.log(`Proposal description: ${proposalDescription}`);

  const proposeTx = await governor.propose(
    [box.address],
    [0],
    [encodeFunctionCall],
    proposalDescription
  );

  const proposeReceipt = await proposeTx.wait(1);
  const proposalEndBlock =
    (await ethers.provider.getBlock(proposeReceipt.blockNumber)).number +
    VOTING_PERIOD;
  console.log(`Proposal created: ${proposalEndBlock}`);

  if (developmentChains.includes(network.name)) {
    await moveBlocks(VOTING_DELAY + 1);
  }

  const proposalId = proposeReceipt.events[0].args.proposalId;
  console.log(`Proposed with proposal ID:\n  ${proposalId}`);

  const proposalState = await governor.state(proposalId);
  const proposalSnapShot = await governor.proposalSnapshot(proposalId);
  const proposalDeadline = await governor.proposalDeadline(proposalId);
  // the Proposal State is an enum data type, defined in the IGovernor contract.
  // 0:Pending,
  // 1:Active,
  // 2:Canceled,
  // 3:Defeated,
  // 4:Succeeded,
  // 5:Queued,
  // 6:Expired,
  // 7:Executed
  console.log(`Current Proposal State: ${proposalState}`);
  // What block # the proposal was snapshot
  console.log(`Current Proposal Snapshot: ${proposalSnapShot}`);
  // The block number the proposal voting expires
  console.log(`Current Proposal Deadline: ${proposalDeadline}`);

  let proposals: any;
  if (!fs.existsSync(proposalsFile)) {
    proposals = {};
    proposals[network.config.chainId!.toString()] = [];
  } else {
    proposals = JSON.parse(fs.readFileSync(proposalsFile).toString());
  }
  proposals[network.config.chainId!.toString()].push(proposalId.toString());
  fs.writeFileSync(proposalsFile, JSON.stringify(proposals));
}

propose([STORE_VALUE], STORE_FUNC, PROPOSAL_DESCRIPTION_EXAMPLE)
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
