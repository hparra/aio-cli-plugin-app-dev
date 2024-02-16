# aio-cli-plugin-app-dev

This command is a new way of looking at local development.
This uses the approach of a simulator, rather than an emulator.

The openwhisk debugger had some heavy requirements, and several serious issues that could not be resolved
- requires Java to be installed on the developer's machine to run the jar
- requires Docker desktop to be installed, up and running
- does not function on all hardware combinations, ex. Apple silicon ...
- step-through debugging is clunky, and must be completed in less that 60 seconds
  - there is a built in timeout so dev cannot sit at a breakpoint without losing connection
  - can only debug 1 action at a time
    - dev has to start another debugger instance for each action in the package
- cannot interact with internet bound services, Files, State, ...
- action hot-reload is clunky with a build/deploy step
  - if an error is encountered it breaks the whole process and developer must ctrl+c and re-run
  - errors are not always shown in output so in many cases it just seems to stop working
- log output is disconnected, since we fully emulate openwhisk activation lifecycle the process needs to poll for activation logs
- does not handle require-adobe-auth
- does not work with events
- clunky, potentially error prone rewriting of config files on launch/exit
  - if a developer is not aware that these files are temporary they could expect to be able to modify them, only to have their changes disappear when the debug process exits
- the solution is complex with many moving parts, and many points of failure
- it is slow, it takes time to setup and teardown


### Gaps:
- When modifying code, and re-calling the action, the latest code is used because we clear node module cache entries, however, if your action code imports/requires another file, this cache is not cleared so changes are not reflected.
- File Storage needs to use our cdn urls, and not AZURE_STORAGE_DOMAIN


<!-- toc -->

<!-- tocstop -->


# Commands
<!-- commands -->

<!-- commandsstop -->

## Contributing

Contributions are welcomed! Read the [Contributing Guide](CONTRIBUTING.md) for more information.

## Licensing

This project is licensed under the Apache V2 License. See [LICENSE](LICENSE) for more information.
