# Neon Solana Signer Changelog
All notable changes to this project will be documented in this file.

## [0.2.0] (2025-5-1)

### Added

* NeonProxyRpcApi – added a simple way to create a ScheduledTransaction
* Methods added to handle the execution sequence of MultipleTransactions
* New data types introduced

### Changed

* Renamed `MultipleTransactions` to `MultipleTransaction`
* Renamed fields in `ScheduledTransaction` (to match the naming conventions used in **ethers.js**)
  * `payer` -> `from`
  * `target` -> `to`
  * `callData` -> `data`


## [0.2.1] (2025-5-2)

### Changed

* NeonProxyRpcApi – `init()` method
* NeonProxyRpcApi – `createScheduledTransaction`, `createMultipleTransaction` methods
