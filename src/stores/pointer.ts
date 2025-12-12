const usePointer = defineStore('pointer', {
    state: () => ({
        x: 0.5,
        y: 0.5,
        lx: 0.5, // last pointer position x
        ly: 0.5, // last pointer position y
    }),
})

export { usePointer }
