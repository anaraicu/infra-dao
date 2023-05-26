import { ethers, upgrades } from "hardhat";
import * as fs from "fs";
import { deploymentsFile } from "../helper-config";
import { DAOFactory } from "../typechain-types";

export async function deployDaoFactory() {
  const daoContractFactory = await ethers.getContractFactory("DAOFactory");

  const content = fs.readFileSync(deploymentsFile, "utf8");
  const data = JSON.parse(content);

  const daoFactory = (await upgrades.deployProxy(
    daoContractFactory,
    [
      data.governanceToken,
      data.membershipNFT,
      data.timeLock,
      data.organizationGovernance,
      data.box,
    ],
    { initializer: "initialize" }
  )) as DAOFactory;
  await daoFactory.deployed();

  data.daoFactory = daoFactory.address;
  fs.writeFileSync(deploymentsFile, JSON.stringify(data, null, 2));
  console.log("OrgDao deployed to:", daoFactory.address);
}

deployDaoFactory().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
