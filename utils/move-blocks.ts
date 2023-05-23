import { network } from "hardhat";

// This function will move blocks for us
export async function moveBlocks(amount: number) {
  console.log("Moving Blocks...");
  for (let index = 0; index < amount; index++) {
    await network.provider.request({
      //  Basically we are mining for our LOCAL blockchain
      method: "evm_mine",
      params: [],
    });
  }
}
