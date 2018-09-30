'use strict';

const SCREEN_WIDTH = 63;
const SCREEN_HEIGHT = 31;

function getDefaultScreen() {
    const screenY = new Array(SCREEN_HEIGHT);
    
    for (let i = 0; i < screenY.length; i += 1) {
        const screenX = new Array(SCREEN_WIDTH);
        for (let j = 0; j < screenX.length; j += 1) {
            screenX[j] = false;
        }
        screenY[i] = screenX;
    }

    return screenY;
}

function getInstruction(opcode) {
    const firstDigit = opcode & 0xF000; 
    switch(firstDigit) {
        case 0x0:
            const thirdAndFourthDigits = opcode & 0x00FF;
            
            if (thirdAndFourthDigits === 0xE0 ||
                thirdAndFourthDigits === 0xEE) {
                return instructionMap[opcode];
            }

            return instructionMap[firstDigit];
        case 0x8:
        case 0xE:
            return instructionMap[opcode & 0xF00F];
        case 0xF:
            const lastDigit = 0x000F;

            if (lastDigit = 0x5) {
                return instructionMap[opcode & 0xF0FF];
            }

            return instructionMap[opcode &0xF00F];
        default:
            return instructionMap[firstDigit];
    }
}

const defaultState = {
        // Program counter
        pc: 0,

        // Memory
        memory: new Array(4096),

        // Stack
        stack: new Array(16),

        // Stack Pointer
        sp: 0,

        // "V" registers
        v: new Array(16),

        // "I" register
        i: 0,

        // Delay timer
        delayTimer: 0,

        // Sound timer
        soundTimer: 0,

        // screen[y][x] 
        screen: getDefaultScreen(),

        // keyboard presses
        pressedKeys: [],

        // halted until a key is pressed
};      haltForKeyPress: false

let state = {};


function constructor() {
    reset();
    run();
}

function reset() {
    state = JSON.parse(JSON.stringify(state));
    state.stack[0] = 0;
}

function run() {
    for(let x = 0; x < 10; x+=1) {
        if (!state.haltForKeyPress) {
            const { memory, pc } = state;
            const opcode = memory[pc] << 8 | memory[pc + 1];
            const instruction = getInstruction(opcode);
            state = instruction(opcode, JSON.parse(JSON.stringify(state)));
            printState();
        }
    }

    window.requestAnimationFrame(run);
}

function keyDownCallback({ keyCode }) {
    state.pressedKeys.push(keyCode);
    state.haltForKeyPress = false;
}

function keyUpCallback({ keyCode }) {
    state.pressedKeys.filter((key) => {
        return key != keyCode;
    });
}

function attachKeyPressCallbacks(element) {
    element.addEventListener('keydown', keyDownCallback);
    element.addEventListener('keyup', keyUpCallback);
}

function removeKeyPressCallbacks(element) {
    element.removeEventListener('keydown', keyDownCallback);
    element.removeEventListener('keyup', keyUpCallback);
}

function loadRomToMemory(rom) {
    const romIntArray = new Uint8Array(rom);

    reset();
    state.memory.splice(0x200,romIntArray.length, ...romIntArray);
}

function printState() {
    console.log('________________________________');
    console.log(`PC:            ${state.pc}`);
    console.log(`Stack:         ${state.stack}`);
    console.log(`Sp:            ${state.sp}`);
    console.log(`V:             ${state.v}`);
    console.log(`I:             ${state.i}`);
    console.log(`DelayTimer:    ${state.delayTimer}`);
    console.log(`SoundTimer:`)
}

const instructionMap = {
    // 0nnn - SYS addr
    0x0: (opcode, state) => {
        const pc = 0x0FFF & opcode;

        return Object.assign(state, { pc });
    },
    // 00E0 - CLS
    0x00E0: () => {
        // clear the display
    },
    // 00EE - RET
    0x00EE: (opcode, { sp, stack, ...rest }) => {
        const pc = stack[sp];
        const newSp = sp - 1;

        return Object.assign(rest, { pc, sp: newSp, stack });
    },
    // 1nnn - JP addr
    0x1: (opcode, state) => {
        const pc = opcode & 0x0FFF;

        return Object.assign(state, { pc });
    },
    // 2nnn - CALL addr 
    0x2: (opcode, { pc, stack, sp, ...rest }) => {
        const newSp = sp + 1;
        const newPc = opcode & 0x0FFF;
        stack[sp] = pc;

        return Object.assign(rest, { stack, sp: newSp, pc: newPc });
    },
    // 3xkk - SE Vx, byte
    0x3: (opcode, { v, pc,  ...rest }) => {
        const register = opcode & 0x0F00;
        const compareVal = opcode & 0x00FF; 
        let newPc = pc;
        
        if (v[register] === compareVal) {
            newPc += 2;
        }

        return Object.assign(rest, { pc: newPc, v });
    },
    // 4xkk SNE Vx, byte
    0x4: (opcode, { v, pc, ...rest }) => {
        const register = opcode & 0x0F00;
        const compareVal = opcode & 0x00FF; 
        let newPc = pc;

        if (v[register] !== compareVal) {
            newPc += 2;
        }

        return Object.assign(rest, { pc: newPc, v});
    },
    // 5xy0 SE Vx, Vy
    0x5: (opcode, { v, pc, ...rest }) => {
        const x = opcode & 0x0F00;
        const y = opcode & 0x00F0; 
        let newPc = pc;

        if (v[x] === v[y]) {
            newPc += 2;
        }

        return Object.assign(rest, { pc: newPc, v });
    },
    // 6xkk - LD Vx, byte
    0x6: (opcode, { v, ...rest }) => {
        const data = opcode & 0x00FF;
        const register = opcode & 0x0F00;

        v[register] = data;

        return Object.assign(rest, { v });
    },
    // 7xkk - ADD Vx, byte
    0x7: (opcode, { v, ...rest }) => {
        const data = opcode & 0x00FF;
        const register = opcode & 0x0F00;

        v[register] += data;

        return Object.assign(rest, { v });
    },
    // 8xy0 - LD Vx, Vy
    0x8000: (opcode, { v, ...rest }) => {
        const x = opcode & 0x0F00;
        const y = opcode & 0x00F0;
        
        v[x] = v[y];

        return Object.assign(rest, { v });
    },
    // 8xy1 - OR Vx, Vy
    0x8001: (opcode, { v, ...rest }) => {
        const x = opcode & 0x0F00;
        const y = opcode & 0x00F0;
        
        v[x] = v[x] | v[y];

        return Object.assign(rest, { v });
    },
    // 8xy2 - AND Vx, Vy
    0x8002: (opcode, { v, ...rest }) => {
        const x = opcode & 0x0F00;
        const y = opcode & 0x00F0;
        
        v[x] = v[x] & v[y];

        return Object.assign(rest, { v });
    },
    // 8xy3 - XOR Vx, Vy
    0x8003: (opcode, { v, ...rest }) => {
        const x = opcode & 0x0F00;
        const y = opcode & 0x00F0;
        
        v[x] ^= v[y];

        return Object.assign(rest, { v });
    },
    // 8xy4 - ADD Vx, Vy
    0x8004: (opcode, { v, ...rest }) => {
        const x = opcode & 0x0F00;
        const y = opcode & 0x00F0;
        let result = x + y;
        v[0xF] = 0;

        if (result > 0xFF) {
            v[0xF] = 1;
            result &= 0xFF; 
        }
        
        v[x] = result;

        return Object.assign(rest, { v });
    },
    // 8xy5 - SUB Vx, Vy
    0x8005: (opcode, { v, ...rest }) => {
        const x = opcode & 0x0F00;
        const y = opcode & 0x00F0;
        v[0xF] = 0;

        if (x > y) {
            v[0xF] = 1;
        }
        
        v[x] -= v[y];

        return Object.assign(rest, { v });
    },
    // 8xy6 - SHR Vx {, Vy}
    0x8006: (opcode, { v, ...rest }) => {
        v[0xF] = 0x0001 & opcode;
        v[x] /= 2; 

        return Object.assign(rest, { v });
    },
    // 8xy7 - SUBN Vx, Vy
    0x8007: () => {
        const x = opcode & 0x0F00;
        const y = opcode & 0x00F0;
        v[0xF] = 0;

        if (y > x) {
            v[0xF] = 1;
        }
        
        v[x] = v[y] - v[x];

        return Object.assign(rest, { v });
    },
    // 8xyE - SHL Vx {, Vy}
    0x800E: (opcode, { v, ...rest }) => {
        v[0xF] = 0x8000 & opcode;
        v[x] *= 2; 

        return Object.assign(rest, { v });
    },
    // 9xy0 - SNE Vx, Vy
    0x9: (opcode, { v, pc, ...rest }) => {
        const x = opcode & 0x0F00;
        const y = opcode & 0x00F0;
        let newPc = pc;

        if (v[x] !== v[y]) {
            newPc +=2
        }

        return Object.assign(rest, { pc: newPc, v });
    },
    // Annn - LD I, addr
    0xA: (opcode, state) => {
        const i = opcode & 0x0FFF;

        return Object.assign(state, { i });
    },
    // Bnnn - JP V0, addr
    0xB: (opcode, { v, ...rest }) => {
        const pc = (0x0FFF & opcode) + v[0];

        return Object.assign(rest, { pc, v });
    },
    // Cxkk - RND Vx, byte
    0xC: (opcode, { v, ...rest }) => {
        const x = 0x0F00 & opcode;
        const rand = Math.floor(Math.random() * Math.floor(0xFF));

        v[x] = rand & (0xFF & opcode);

        return Object.assign(rest, { v });
    },
    // Dxyn - DRW Vx, Vy, nibble
    0xD: (opcode, { v, i, memory, screen,  ...rest }) => {
        const vX = v[0x0F00 & opcode];
        const vY = v[0x00F0 & opcode];
        const n = 0x000F & opcode;

        const sprite = memory.slice(i, n+1);
	
        for (let i = 0; i < sprite.length; i += 1) {
            const row = sprite[i];
            const byte = row.toString(2);
            const fullByte = "00000000".substring(byte.length) + byte;
            const screenY = (vY + i) % 63;
            for (let j = 0; j < 8; j += 1) {
                const screenX = (vX + j) % 63;
                
                screen[screenY][screenX] ^= fullByte.charAt(j);
                if (!screen[screenY][screenX]) {
                    v[0xF] = 1;
                }
            }
        }
	
        return Object.assign(rest, { v, i, memory, screen });	
    },
    // Ex9E - SKP Vx
    0xE00E: (opcode, { v, pc, pressedKeys, ...rest }) => {
        let newPc = pc;

        if (pressedKeys.includes(v[opcode & 0x0F00])) {
            newPc += 2;
        
        }

        return Object.assign(rest, { pc: newPc, v, pressedKeys })
    },
    // ExA1 - SKNP Vx
    0xE001: (opcode, { v, pc, pressedKeys, ...rest }) => {
        let newPc = pc;

        if (!pressedKeys.includes(v[opcode & 0x0F00])) {
            newPc += 2;
        
        }

        return Object.assign(rest, { pc: newPc, v, pressedKeys })
    },
    // Fx07 - LD Vx, DT
    0xF007: (opcode, { v, delayTimer, ...rest }) => {
        const x = 0x0F00 & opcode;

        v[x] = delayTimer;

        return Object.assign(rest, { v, delayTimer });
    },
    //Fx0A - LD Vx, K
    0xF00A: (opcode, { v, ...rest }) => {
        return Object.assign(rest, { v, haltForKeyPress: true });
    },
    //Fx15 - LD DT, Vx
    0xF015: (opcode, { v, ...rest }) => {
        const x = 0x0F00 & opcode;

        return Object.assign(rest, { v, delayTimer: v[x] });
    },
    //Fx18 - LD ST, Vx
    0xF008: (opcode, { v, ...rest }) => {
        const x = 0x0F00 & opcode;

        return Object.assign(rest, { v, soundTimer: v[x] });
    },
    //Fx1E - ADD I, Vx
    0xF00E: (opcode, { v, i, ...rest }) => {
        const x = 0x0F00 & opcode;

        return Object.assign(rest, { v, i: i + v[x] });
    },
    //Fx29 - LD F, Vx
    0xF009: (opcode, { v, ...rest }) => {
        const x = 0x0F00 & opcode;

        return Object.assign(rest, { v, i: hexDisplayMap[v[x]] });
    },
    //Fx33 - LD B, Vx
    0xF003: (opcode, { v, i, memory }) => {
        const val = v[0x0F00 & opcode];
        const strVal = val.toString();
        const fullVal = "000".substring(strVal.length) + strval;

        for (let j = 0; j < 3; j+=1) {
            memory[i+j] = fullVal[j];
        }
        
        return Object.assign(rest, { v, i, memory });
    },
    //Fx55 - LD [I], Vx
    0xF055: (opcode, { v, i, memory }) => {
        const x = 0x0F00 & opcode;

        for (let j = 0; j <= x; j+=1) {
            memory[i+j] = v[j];
        }

        Object.assign(rest, { v, i, memory });
    },
    //Fx65 - LD Vx, [I]
    0xF065: (opcode, { v, i, memory }) => {
        const x = 0x0F00 & opcode;

        for (let j = 0; j <= x; j+=1) {
            v[j] = memory[i+j];
        }
        Object.assign(rest, { v, i, memory });
    }

};

const hexDisplayMap = {
    0x0: 0x00,
    0x1: 0x05,
    0x2: 0x0A,
    0x3: 0x0E,
    0x4: 0x13,
    0x5: 0x18,
    0x6: 0x1D,
    0x7: 0x22,
    0x8: 0x27,
    0x9: 0x2C,
    0xA: 0x31,
    0xB: 0x36,
    0xC: 0x3B,
    0xD: 0x40,
    0xE: 0x45,
    0xF: 0x4A
}

const keyMap = {
    0x0: 88,
    0x1: 49,
    0x2: 50,
    0x3: 51,
    0x4: 81,
    0x5: 87,
    0x6: 69,
    0x7: 65,
    0x8: 83,
    0x9: 68,
    0xA: 90,
    0xB: 67,
    0xC: 52,
    0xD: 82,
    0xE: 70,
    0xF: 86
}

constructor();
