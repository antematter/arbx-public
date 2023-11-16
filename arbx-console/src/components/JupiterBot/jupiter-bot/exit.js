const logExit = (code = 0, error) => {
  code === 0 && console.log(error.message);

  if (code === 1) {
    error?.message && console.log('ERROR: ' + error.message);
    error?.stack && console.log(error.stack);
  }
};

export { logExit };
