#!/bin/zsh
cd -- "${0:A:h}"
python3 backend/server.py --open-browser
if [[ $? -ne 0 ]]; then
  printf '\nGame could not start. Press Return to close.\n'
  read
fi
