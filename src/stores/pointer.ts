const usePointer = defineStore('pointer', {
    state: () => ({
        x: -1000,
        y: -1000,
        lx: -1000, // last pointer position x
        ly: -1000, // last pointer position y
    }),
})

export { usePointer }
