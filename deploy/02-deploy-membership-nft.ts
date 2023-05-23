import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { toUtf8Bytes } from "ethers/lib/utils";
import { MembershipNFT, MembershipNFT__factory } from "../typechain-types";

const deployMembershipNFT: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  console.log("Deploying MembershipNFT...");

  const { getNamedAccounts, deployments, network } = hre;
  const { deploy, log } = deployments;

  const { deployer } = await getNamedAccounts();
  const uri = "";
  // "https://gateway.pinata.cloud/ipfs/QmaSFfxno1hRqBave6RVgEvYvGiWzhK3Cyytyxnp4MSVod/100.json"; // TODO: MODIFY THIS TO YOUR OWN URI
  const initialSupply = 10;
  // const contractFactory = await ethers.getContractFactory("MembershipNFT");
  // const contract = await contractFactory.deploy(uri, initialSupply);
  // console.log(">>>", contract);
  // const logs = {
  //   from: deployer,
  //   args: [uri, initialSupply],
  //   log: true,
  //   gasLimit: 10000000,
  // };
  // const membershipNFT = await deploy("MembershipNFT", logs);
  const membershipNFTFactory = (await ethers.getContractFactory(
    "MembershipNFT"
  )) as MembershipNFT__factory;
  const membershipNFT = (await upgrades.deployProxy(
    membershipNFTFactory,
    [uri, initialSupply],
    { initializer: "initialize" }
  )) as MembershipNFT;
  await membershipNFT.deployed();

  log(`Deployed MembershipNFT to address ${membershipNFT.address}`);
  await mintMembershipNFT(membershipNFT.address, deployer);
  log(`Minted MembershipNFT`);
};

const mintMembershipNFT = async (
  membershipNFTAddress: string,
  delegatedAccount: string
) => {
  // Optional: mint some tokens for testing purposes
  const membershipNFT = await ethers.getContractAt(
    "MembershipNFT",
    membershipNFTAddress
  );
  const tx1 = await membershipNFT.mint(
    delegatedAccount,
    0,
    10,
    toUtf8Bytes("")
  );
  await tx1.wait(1);
};

export default deployMembershipNFT;
