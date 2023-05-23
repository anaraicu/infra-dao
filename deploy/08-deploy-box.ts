import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { getContract } from "@nomiclabs/hardhat-ethers/internal/helpers";

const deployBox: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  const { getNamedAccounts, deployments } = hre;
  const { deploy, log, get } = deployments;
  const { deployer } = await getNamedAccounts();
  const simpleGovernance = await get("OrganizationGovernance");

  log("Deploying Box...");
  const box = await deploy("Box", {
    from: deployer,
    args: [simpleGovernance.address],
    log: true,
  });

  // want to give the box's ownership over the governance process
  const boxContract = await ethers.getContractAt("Box", box.address);
  const timeLock = await ethers.getContract("TimeLock");
  const transferOwnerTx = await boxContract.transferOwnership(timeLock.address);
  await transferOwnerTx.wait(1);
  log("DONE");
};

export default deployBox;
