class UserService {
  setSubService(_subService) {
    this.subService = _subService;
  }

  getUser() {
    return { name: "mohammed", age: 20 };
  }
}

class SubService {
  setUserService(_userService) {
    this.userService = _userService;
  }

  getSub() {
    const user = this.userService.getUser();
    console.log(`${user.name} is sub`);
  }
}

const context = {};

function initContext(...cls) {
  for (const cl of cls) {
    context[cl.name] = new cl();

    for (const _cl of cls) {
      if (cl.name === _cl.name) continue;
      console.log(`set${_cl.name}`);
      context[cl.name][`set${_cl.name}`](context[_cl.name]);
    }
  }
}

initContext(UserService, SubService);
console.log(context);
context[SubService.name].getSub();
