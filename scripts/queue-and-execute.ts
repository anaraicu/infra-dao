import { ethers, network } from "hardhat";
import {
  developmentChains,
  STORE_FUNC,
  MIN_DELAY,
  STORE_VALUE,
  PROPOSAL_DESCRIPTION_EXAMPLE,
  deploymentsFile,
} from "../helper-config";
import { moveBlocks } from "../utils/move-blocks";
import { moveTime } from "../utils/move-time";
import fs from "fs";
import { DAOFactory } from "../typechain-types";

export async function queueAndExecute() {
  const content = fs.readFileSync(deploymentsFile, "utf8");
  const data = JSON.parse(content);

  const daoFactory = (await ethers.getContractAt(
    "DAOFactory",
    data.daoFactory
  )) as DAOFactory;
  const count = (await daoFactory.getDAOCount()).toNumber();

  const args = [STORE_VALUE];
  const box = await ethers.getContractAt("Box", data[count]["box"]);
  const encodedFunctionCall = box.interface.encodeFunctionData(
    STORE_FUNC,
    args
  );
  const descriptionHash = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(PROPOSAL_DESCRIPTION_EXAMPLE)
  ); // look for the description hash on-chain -
  // it is cheaper to look for hash (gas-wise) than to look for the string itself

  const governor = await ethers.getContractAt(
    "OrganizationGovernance",
    data[count]["organizationGovernance"]
  );

  console.log("Queueing...");
  const queueTx = await governor.queue(
    [box.address],
    [0],
    [encodedFunctionCall],
    descriptionHash
  );
  await queueTx.wait(1);

  if (developmentChains.includes(network.name)) {
    await moveTime(MIN_DELAY + 1);
    await moveBlocks(1);
  }

  console.log("Executing");
  const executeTx = await governor.execute(
    [box.address],
    [0],
    [encodedFunctionCall],
    descriptionHash
  );
  await executeTx.wait(1);

  const boxNewValue = await box.retrieve();
  console.log(`New Box Value: ${boxNewValue.toString()}`);
}

// queue function is in GovernorTimeLockController in extensions
queueAndExecute()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
