import { ethers, upgrades } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";
import { GovernanceToken } from "../typechain-types";
import { solidity } from "ethereum-waffle";

const chai = require("chai");
chai.use(solidity);

describe("GovernanceTokenUnitTests", function () {
  let governanceToken: GovernanceToken;
  let owner: Signer;
  let addr1: Signer;
  let addr2: Signer;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const governanceTokenFactory = await ethers.getContractFactory(
      "GovernanceToken",
      owner
    );

    governanceToken = (await upgrades.deployProxy(governanceTokenFactory, [], {
      initializer: "initialize",
    })) as GovernanceToken;
    await governanceToken.deployed();
  });

  it("should have the correct name and symbol", async function () {
    expect(await governanceToken.name()).to.equal("GovernanceToken");
    expect(await governanceToken.symbol()).to.equal("GOV");
  });

  it("should update supply when new minting happens", async function () {
    const initialSupply = await governanceToken.totalSupply();
    const amount = ethers.utils.parseEther("100");
    await governanceToken.connect(owner).mint(await owner.getAddress(), amount);
    const totalSupply = await governanceToken.totalSupply();
    expect(totalSupply).to.equal(initialSupply.add(amount));
  });

  it("should mint new tokens to another address", async function () {
    const amount = ethers.utils.parseEther("100");
    const tx = await governanceToken
      .connect(owner)
      .mint(await addr1.getAddress(), amount);
    await tx.wait();
    expect(await governanceToken.getVotes(await addr1.getAddress())).to.equal(
      amount
    );
  });

  it("should keep track of voting power", async function () {
    const amount = ethers.utils.parseEther("0.0001");

    const mintTx = await governanceToken
      .connect(owner)
      .mint(await owner.getAddress(), amount);
    await mintTx.wait(1);

    expect(await governanceToken.getVotes(await owner.getAddress())).to.equal(
      0.0001 * 10 ** 18
    );

    const tx = await governanceToken
      .connect(owner)
      .transfer(addr1.getAddress(), amount);
    await tx.wait(1);
    // Check that the voting power for addr1 is equal to the total supply
    expect(await governanceToken.getVotes(await owner.getAddress())).to.equal(
      0
    );

    // Check that the voting power for owner is zero
    expect(await governanceToken.getVotes(await addr1.getAddress())).to.equal(
      0.0001 * 10 ** 18
    );
  });
});
