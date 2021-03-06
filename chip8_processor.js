'use strict';

const SCREEN_WIDTH = 64;
const SCREEN_HEIGHT = 32;
const hexChars = [
    0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
    0x20, 0x60, 0x20, 0x20, 0x70, // 1
    0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
    0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
    0x90, 0x90, 0xF0, 0x10, 0x10, // 4
    0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
    0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
    0xF0, 0x10, 0x20, 0x40, 0x40, // 7
    0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
    0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
    0xF0, 0x90, 0xF0, 0x90, 0x90, // A
    0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
    0xF0, 0x80, 0x80, 0x80, 0xF0, // C
    0xE0, 0x90, 0x90, 0x90, 0xE0, // D
    0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
    0xF0, 0x80, 0xF0, 0x80, 0x80 // F
];
const hexDisplayMap = {
    0x0: 0x00,
    0x1: 0x05,
    0x2: 0x0A,
    0x3: 0x0F,
    0x4: 0x14,
    0x5: 0x19,
    0x6: 0x1E,
    0x7: 0x23,
    0x8: 0x28,
    0x9: 0x2D,
    0xA: 0x32,
    0xB: 0x37,
    0xC: 0x3C,
    0xD: 0x41,
    0xE: 0x46,
    0xF: 0x4B
}
const keyMap = {
    88: 0x0,
    49: 0x1,
    50: 0x2,
    51: 0x3,
    81: 0x4,
    87: 0x5,
    69: 0x6,
    65: 0x7,
    83: 0x8,
    68: 0x9,
    90: 0xA,
    67: 0xB,
    52: 0xC,
    82: 0xD,
    70: 0xE,
    86: 0xF
}
let state = {};
let debug = false;

function getDefaultScreen() {
    const screenY = new Array(SCREEN_HEIGHT);
    const screenElement = document.getElementById('screen');
    const screenClone = screenElement.cloneNode(false);
    screenClone.insertAdjacentHTML('beforeend', `<rect id="background" x="0" y="0" width="100%" height="100%" fill="black" />`);
    
    
    for (let i = 0; i < screenY.length; i += 1) {
        const screenX = new Array(SCREEN_WIDTH);
        for (let j = 0; j < screenX.length; j += 1) {
            screenClone.insertAdjacentHTML('beforeend', `<rect id="${j}_${i}" x="${j}" y="${i}" width="1" height="1" />`);
            screenX[j] = 0;
        }
        screenY[i] = screenX;
    }

    screenElement.parentNode.replaceChild(screenClone, screenElement);
    return screenY;
}

function getDefaultMemory() {
    const memory = new Array(4096);
    
    memory.splice(0, hexChars.length, ...hexChars);

    return memory;
}

const defaultState = {
    // Program counter
    pc: 0x200,

    // Memory
    memory: getDefaultMemory(),

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
    haltForKeyPress: false
}; 

const instructionMap = {
    // 0nnn - SYS addr
    0x0000: (opcode, state) => {
        const pc = 0x0FFF & opcode;

        return Object.assign(state, { pc });
    },
    // 00E0 - CLS
    0x00E0: (opcode, state) => {
        state.screen = getDefaultScreen();

        return state;
    },
    // 00EE - RET
    0x00EE: (opcode, { sp, stack, ...rest }) => {
        const pc = stack[sp];
        const newSp = sp - 1;

        return Object.assign(rest, { pc, sp: newSp, stack });
    },
    // 1nnn - JP addr
    0x1000: (opcode, state) => {
        const pc = opcode & 0x0FFF;

        return Object.assign(state, { pc });
    },
    // 2nnn - CALL addr 
    0x2000: (opcode, { pc, stack, sp, ...rest }) => {
        const newSp = sp + 1;
        const newPc = opcode & 0x0FFF;
        stack[newSp] = pc;

        return Object.assign(rest, { stack, sp: newSp, pc: newPc });
    },
    // 3xkk - SE Vx, byte
    0x3000: (opcode, { v, pc,  ...rest }) => {
        const register = (opcode & 0x0F00) >> 8;
        const compareVal = opcode & 0x00FF; 
        let newPc = pc;
        
        if (v[register] === compareVal) {
            newPc += 2;
        }

        return Object.assign(rest, { pc: newPc, v });
    },
    // 4xkk SNE Vx, byte
    0x4000: (opcode, { v, pc, ...rest }) => {
        const register = (opcode & 0x0F00) >> 8;
        const compareVal = opcode & 0x00FF; 
        let newPc = pc;

        if (v[register] !== compareVal) {
            newPc += 2;
        }

        return Object.assign(rest, { pc: newPc, v});
    },
    // 5xy0 SE Vx, Vy
    0x5000: (opcode, { v, pc, ...rest }) => {
        const x = (opcode & 0x0F00) >> 8;
        const y = (opcode & 0x00F0) >> 4; 
        let newPc = pc;

        if (v[x] === v[y]) {
            newPc += 2;
        }

        return Object.assign(rest, { pc: newPc, v });
    },
    // 6xkk - LD Vx, byte
    0x6000: (opcode, { v, ...rest }) => {
        const data = opcode & 0x00FF;
        const register = (opcode & 0x0F00) >> 8;

        v[register] = data;

        return Object.assign(rest, { v });
    },
    // 7xkk - ADD Vx, byte
    0x7000: (opcode, { v, ...rest }) => {
        const data = opcode & 0x00FF;
        const register = (opcode & 0x0F00) >> 8;

        v[register] += data;
        v[register] &= 0xFF;

        return Object.assign(rest, { v });
    },
    // 8xy0 - LD Vx, Vy
    0x8000: (opcode, { v, ...rest }) => {
        const x = (opcode & 0x0F00) >> 8;
        const y = (opcode & 0x00F0) >> 4;
        
        v[x] = v[y];

        return Object.assign(rest, { v });
    },
    // 8xy1 - OR Vx, Vy
    0x8001: (opcode, { v, ...rest }) => {
        const x = (opcode & 0x0F00) >> 8;
        const y = (opcode & 0x00F0) >> 4;
        
        v[x] = v[x] | v[y];

        return Object.assign(rest, { v });
    },
    // 8xy2 - AND Vx, Vy
    0x8002: (opcode, { v, ...rest }) => {
        const x = (opcode & 0x0F00) >> 8;
        const y = (opcode & 0x00F0) >> 4;
        
        v[x] = v[x] & v[y];

        return Object.assign(rest, { v });
    },
    // 8xy3 - XOR Vx, Vy
    0x8003: (opcode, { v, ...rest }) => {
        const x = (opcode & 0x0F00) >> 8;
        const y = (opcode & 0x00F0) >> 4;
        
        v[x] ^= v[y];

        return Object.assign(rest, { v });
    },
    // 8xy4 - ADD Vx, Vy
    0x8004: (opcode, { v, ...rest }) => {
        const x = (opcode & 0x0F00) >> 8;
        const y = (opcode & 0x00F0) >> 4;
        let result = v[x] + v[y];
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
        const x = (opcode & 0x0F00) >> 8;
        const y = (opcode & 0x00F0) >> 4;
        v[0xF] = 0;

        if (v[x] > v[y]) {
            v[0xF] = 1;
        }
        
        v[x] -= v[y];

        return Object.assign(rest, { v });
    },
    // 8xy6 - SHR Vx {, Vy}
    0x8006: (opcode, { v, ...rest }) => {
        const x = (opcode & 0x0F00) >> 8;
        v[0xF] = 0x01 & v[x];
        v[x] >>= 1; 

        return Object.assign(rest, { v });
    },
    // 8xy7 - SUBN Vx, Vy
    0x8007: (opcode, { v, ...rest }) => {
        const x = (opcode & 0x0F00) >> 8;
        const y = (opcode & 0x00F0) >> 4;
        v[0xF] = 0;

        if (v[y] > v[x]) {
            v[0xF] = 1;
        }
        
        v[x] = v[y] - v[x];

        return Object.assign(rest, { v });
    },
    // 8xyE - SHL Vx {, Vy}
    0x800E: (opcode, { v, ...rest }) => {
        const x = (opcode & 0x0F00) >> 8;
        v[0xF] = v[x] >> 7;
        v[x] *= 2; 

        return Object.assign(rest, { v });
    },
    // 9xy0 - SNE Vx, Vy
    0x9000: (opcode, { v, pc, ...rest }) => {
        const x = (opcode & 0x0F00) >> 8;
        const y = (opcode & 0x00F0) >> 4;
        let newPc = pc;

        if (v[x] !== v[y]) {
            newPc +=2
        }

        return Object.assign(rest, { pc: newPc, v });
    },
    // Annn - LD I, addr
    0xA000: (opcode, state) => {
        const i = opcode & 0x0FFF;

        return Object.assign(state, { i });
    },
    // Bnnn - JP V0, addr
    0xB000: (opcode, { v, ...rest }) => {
        const pc = (0x0FFF & opcode) + v[0];

        return Object.assign(rest, { pc, v });
    },
    // Cxkk - RND Vx, byte
    0xC000: (opcode, { v, ...rest }) => {
        const x = (0x0F00 & opcode) >> 8;
        const rand = Math.floor(Math.random() * Math.floor(0xFF));

        v[x] = rand & (0xFF & opcode);

        return Object.assign(rest, { v });
    },
    // Dxyn - DRW Vx, Vy, nibble
    0xD000: (opcode, { v, i, memory, screen,  ...rest }) => {
        const vX = v[(0x0F00 & opcode) >> 8] || 0;
        const vY = v[(0x00F0 & opcode) >> 4] || 0;
        const n = 0x000F & opcode;
        let collision = 0;

        const sprite = memory.slice(i, i+n);
	
        for (let a = 0; a < sprite.length; a += 1) {
            const row = sprite[a];
            const byte = row.toString(2);
            const fullByte = "00000000".substring(byte.length) + byte;
            const screenY = (vY + a) % SCREEN_HEIGHT;
            for (let j = 0; j < 8; j += 1) {
                const screenX = (vX + j) % SCREEN_WIDTH;
                const oldPixel = screen[screenY][screenX];

                screen[screenY][screenX] ^= fullByte.charAt(j);
                if (!screen[screenY][screenX] && oldPixel) {
                    collision = 1;
                }
            }
        }

        v[0xf] = collision;

        return Object.assign(rest, { v, i, memory, screen });	
    },
    // Ex9E - SKP Vx
    0xE00E: (opcode, { v, pc, pressedKeys, ...rest }) => {
        let newPc = pc;

        if (pressedKeys.includes(v[(opcode & 0x0F00) >> 8])) {
            newPc += 2;
        }

        return Object.assign(rest, { pc: newPc, v, pressedKeys })
    },
    // ExA1 - SKNP Vx
    0xE001: (opcode, { v, pc, pressedKeys, ...rest }) => {
        let newPc = pc;

        if (!pressedKeys.includes(v[(opcode & 0x0F00) >> 8])) {
            newPc += 2;
        }

        return Object.assign(rest, { pc: newPc, v, pressedKeys })
    },
    // Fx07 - LD Vx, DT
    0xF007: (opcode, { v, delayTimer, ...rest }) => {
        const x = (0x0F00 & opcode) >> 8;

        v[x] = delayTimer;

        return Object.assign(rest, { v, delayTimer });
    },
    //Fx0A - LD Vx, K
    0xF00A: (opcode, state) => {
        state.haltForKeyPress = (0x0F00 & opcode) >> 8;

        return state;
    },
    //Fx15 - LD DT, Vx
    0xF015: (opcode, { v, ...rest }) => {
        const x = (0x0F00 & opcode) >> 8;

        return Object.assign(rest, { v, delayTimer: v[x] });
    },
    //Fx18 - LD ST, Vx
    0xF008: (opcode, { v, ...rest }) => {
        const x = (0x0F00 & opcode) >> 8;

        return Object.assign(rest, { v, soundTimer: v[x] });
    },
    //Fx1E - ADD I, Vx
    0xF00E: (opcode, { v, i, ...rest }) => {
        const x = (0x0F00 & opcode) >> 8;

        return Object.assign(rest, { v, i: i + v[x] });
    },
    //Fx29 - LD F, Vx
    0xF009: (opcode, { v, ...rest }) => {
        const x = (0x0F00 & opcode) >> 8;

        return Object.assign(rest, { v, i: hexDisplayMap[v[x]] });
    },
    //Fx33 - LD B, Vx
    0xF003: (opcode, { v, i, memory, ...rest }) => {
        const val = v[(0x0F00 & opcode) >> 8];
        const strVal = val.toString();
        const fullVal = "000".substring(strVal.length) + strVal;

        for (let j = 0; j < 3; j+=1) {
            memory[i+j] = Number(fullVal[j]);
        }
        
        return Object.assign(rest, { v, i, memory });
    },
    //Fx55 - LD [I], Vx
    0xF055: (opcode, { v, i, memory, ...rest }) => {
        const x = (0x0F00 & opcode) >>> 8;

        for (let j = 0; j <= x; j+=1) {
            memory[i+j] = v[j];
        }

        return Object.assign(rest, { v, i, memory });
    },
    //Fx65 - LD Vx, [I]
    0xF065: (opcode, { v, i, memory, ...rest }) => {
        const x = (0x0F00 & opcode) >> 8;

        for (let j = 0; j <= x; j+=1) {
            v[j] = memory[i+j];
        }
        return Object.assign(rest, { v, i, memory });
    }

};

function reset() {
    state = JSON.parse(JSON.stringify(defaultState));
    state.stack[0] = 0;
}

function run() {
    for(let x = 0; x < 10; x+=1) {
        if (!state.haltForKeyPress) {
            const { memory, pc } = state;
            const opcode = memory[pc] << 8 | memory[pc + 1];
            const firstDigit = opcode & 0xF000;
            let instruction = null;
            
            switch(firstDigit) {
                case 0x0000:
                    if ((opcode & 0x00FF) === 0xE0 ||
                        (opcode & 0x00FF) === 0xEE) {
                        instruction = instructionMap[opcode];
                    } else {
                   	 instruction = instructionMap[firstDigit];
		    }
                    break;
                case 0x8000:
                case 0xE000:
                    instruction = instructionMap[opcode & 0xF00F];
                    break;
                case 0xF000:
                    if ((opcode & 0x000F) === 0x0005) {
                        instruction = instructionMap[opcode & 0xF0FF];
                    } else {
                    	instruction = instructionMap[opcode & 0xF00F];
		    }
                    break;
                default:
                    instruction = instructionMap[firstDigit];
            }
            
            const newState = instruction(opcode, JSON.parse(JSON.stringify(state)));
            
            if (newState.delayTimer > 0) {
                newState.delayTimer -= 1;
            }
            if (newState.soundTimer > 0) {
                newState.soundTimer -= 1;
                if (!soundPlaying) {
                    oscillator = context.createOscillator();
                    oscillator.start(context.currentTime);
                    oscillator.connect(context.destination);
                    console.log("start")
                    soundPlaying = true;
                }
            } else if (soundPlaying) {
                oscillator.stop(context.currentTime);
                oscillator.disconnect(context.destination);
                oscillator = null;
                console.log("stop")
                soundPlaying = false;
            }
            printState(opcode, newState, pc);

            if (![0x1000, 0x2000, 0xB000].includes(0xF000 & opcode)) {
                newState.pc += 2;
            }
            state = newState;
        }
    }
    writeToSvg(state.screen);
    window.requestAnimationFrame(run);
}
