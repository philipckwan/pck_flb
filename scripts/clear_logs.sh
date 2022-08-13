#!/bin/bash

echo "clear_logs: start;"
> ./log/pck-dev.log
> ./log/pck-flashloan_tx.log
> ./log/pck-stats.log
> ./log/pck-blockNum.log
echo "clear_logs: end;"
