// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/governance/TimelockControllerUpgradeable.sol";

contract TimeLock is TimelockControllerUpgradeable {
    /*
    minDelay: how long you have to wait before executing
    proposers: list of addresss that can propose
    executors: who can execute when a proposal passes quorum
  */

    uint256 delay;

    uint256 public constant GRACE_PERIOD = 2 days;
    uint256 public constant MINIMUM_DELAY = 1 days;
    uint256 public constant MAXIMUM_DELAY = 30 days;

    mapping(bytes32 => bool) public queuedTransactions;

    event NewDelay(uint256 indexed newDelay);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        uint256 _minDelay,
        // Make the governor the only one able to execute and everyone able to propose
        address[] memory _proposers,
        address[] memory _executors,
        address admin
    ) public initializer {
        __TimelockController_init(_minDelay, _proposers, _executors, admin);
        delay = _minDelay;
    }

    function setDelay(uint256 delay_) public {
        require(
            msg.sender == address(this),
            "Timelock::setDelay: Call must come from Timelock."
        );
        require(
            delay_ >= MINIMUM_DELAY,
            "Timelock::setDelay: Delay must exceed minimum delay."
        );
        require(
            delay_ <= MAXIMUM_DELAY,
            "Timelock::setDelay: Delay must not exceed maximum delay."
        );
        delay = delay_;

        emit NewDelay(delay);
    }
}

// Additional contract that is actually the owner
// GovernorContract and TimeLock are esentially the same, but
// TimeLock will be the owner of the Box contract

// We want to wait for a vote to be executed:
// e.g. Everyone who holds the governance token has to pay 5 toknes
// Give time to users to "get out" if they don't want a governance token
