const usePointer = defineStore('pointer', {
    state: () => ({
        x: -1, // normalize x
        y: -1, // normalize y
        ox: -1000, // origin x
        oy: -1000, // origin y
        lx: -1, // last pointer position x
        ly: -1, // last pointer position y
    }),
})

export { usePointer }
