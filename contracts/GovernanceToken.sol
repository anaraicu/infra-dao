// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";

contract GovernanceToken is ERC20VotesUpgradeable {
    // 18 decimals as default
    address owner;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __ERC20_init("GovernanceToken", "GOV");
        __ERC20Permit_init("GovernanceToken");
        __ERC20Votes_init();

        owner = msg.sender;
    }

    function mint(address to, uint256 amount) public {
        require(msg.sender == owner, "only owner can mint");
        _mint(to, SafeMathUpgradeable.mul(amount, amount));
    }

    function delegates(
        address account
    ) public view virtual override returns (address) {
        return account;
    }

    //    function _afterTokenTransfer(
    //        address from,
    //        address to,
    //        uint256 amount
    //    ) internal override(ERC20Votes) {
    //        super._afterTokenTransfer(from, to, amount);
    //    }
    //
    //    function _burn(
    //        address account,
    //        uint256 amount
    //    ) internal override(ERC20Votes) {
    //        super._burn(account, amount);
    //    }

    // ERC20Votes keeps a snapshot of the total supply on every transfer
    // It keeps a history of snapshots on each account's voting power

    // VP can be delegated or checked with delegate() and getPastVotes()
}
