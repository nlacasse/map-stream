'use strict';

var map = require('../')
  , it = require('it-is')
  , u = require('ubelt')
  , spec = require('stream-spec')
  , from = require('from')
  , Stream = require('stream')
  , es = require('event-stream')

//REFACTOR THIS TEST TO USE es.readArray and es.writeArray

function writeArray(array, stream) {

  array.forEach( function (j) {
    stream.write(j)
  })
  stream.end()

}

function readStream(stream, done) {

  var array = [] 
  stream.on('data', function (data) {
    array.push(data)
  })
  stream.on('error', done)
  stream.on('end', function (data) {
    done(null, array)
  })

} 

//call sink on each write,
//and complete when finished.

function pauseStream (prob, delay) { 
  var pauseIf = (
      'number' == typeof prob 
    ? function () {
        return Math.random() < prob
      } 
    : 'function' == typeof prob 
    ? prob
    : 0.1
  )
  var delayer = ( 
      !delay 
    ? process.nextTick
    : 'number' == typeof delay 
    ? function (next) { setTimeout(next, delay) }
    : delay
  )   

  return es.through(function (data) {    
    if(!this.paused && pauseIf()) {
      console.log('PAUSE STREAM PAUSING')
      this.pause()
      var self = this
      delayer(function () {
        console.log('PAUSE STREAM RESUMING')
        self.resume()
      })
    }
    console.log("emit ('data', " + data + ')')
    this.emit('data', data) 
  })
}

exports ['simple map applied to a stream'] = function (test) {

  var input = [1,2,3,7,5,3,1,9,0,2,4,6]
  //create event stream from

  var doubler = map(function (data, cb) {
    cb(null, data * 2)
  })

  spec(doubler).through().validateOnExit()

  //a map is only a middle man, so it is both readable and writable
  
  it(doubler).has({
    readable: true,
    writable: true,   
  })

  readStream(doubler, function (err, output) {
    it(output).deepEqual(input.map(function (j) {
      return j * 2
    }))
//    process.nextTick(x.validate)
    test.done()
  })
  
  writeArray(input, doubler)
  
}

exports['pipe two maps together'] = function (test) {

  var input = [1,2,3,7,5,3,1,9,0,2,4,6]
  //create event stream from
  function dd (data, cb) {
    cb(null, data * 2)
  }
  var doubler1 = map(dd), doubler2 = map(dd)

  doubler1.pipe(doubler2)
  
  spec(doubler1).through().validateOnExit()
  spec(doubler2).through().validateOnExit()

  readStream(doubler2, function (err, output) {
    it(output).deepEqual(input.map(function (j) {
      return j * 4
    }))
    test.done()
  })
  
  writeArray(input, doubler1)

}

//next:
//
// test pause, resume and drian.
//

// then make a pipe joiner:
//
// plumber (evStr1, evStr2, evStr3, evStr4, evStr5)
//
// will return a single stream that write goes to the first 

exports ['map will not call end until the callback'] = function (test) {

  var ticker = map(function (data, cb) {
    process.nextTick(function () {
      cb(null, data * 2)
    })
  })

  spec(ticker).through().validateOnExit()

  ticker.write('x')
  ticker.end() 

  ticker.on('end', function () {
    test.done()
  })
}


exports ['emit error thrown'] = function (test) {

  var err = new Error('INTENSIONAL ERROR')
    , mapper = 
  map(function () {
    throw err
  })

  mapper.on('error', function (_err) {
    it(_err).equal(err)  
    test.done()
  })

  mapper.write('hello')

}

exports ['emit error calledback'] = function (test) {

  var err = new Error('INTENSIONAL ERROR')
    , mapper = 
  map(function (data, callback) {
    callback(err)
  })

  mapper.on('error', function (_err) {
    it(_err).equal(err)  
    test.done()
  })

  mapper.write('hello')

}

exports ['do not emit drain if not paused'] = function (test) {

  var maps = map(function (data, callback) {
    u.delay(callback)(null, 1)
    return true
  })
  
  spec(maps).through().pausable().validateOnExit()

  maps.on('drain', function () {
    it(false).ok('should not emit drain unless the stream is paused')
  })

  it(maps.write('hello')).equal(true)
  it(maps.write('hello')).equal(true)
  it(maps.write('hello')).equal(true)
  setTimeout(function () {maps.end()},10)
  maps.on('end', test.done)
}

exports ['emits drain if paused, when all '] = function (test) {
  var active = 0
  var drained = false
  var maps = map(function (data, callback) {
    active ++
    u.delay(function () {
      active --
      callback(null, 1)
    })()
    console.log('WRITE', false)
    return false
  })

  spec(maps).through().validateOnExit()

  maps.on('drain', function () {
    drained = true
    it(active).equal(0, 'should emit drain when all maps are done')
  })

  it(maps.write('hello')).equal(false)
  it(maps.write('hello')).equal(false)
  it(maps.write('hello')).equal(false)

  process.nextTick(function () {maps.end()},10)

  maps.on('end', function () {
    console.log('end')
    it(drained).ok('shoud have emitted drain before end')
    test.done() 
  })

}

exports ['map applied to a stream with filtering'] = function (test) {

  var input = [1,2,3,7,5,3,1,9,0,2,4,6]

  var doubler = map(function (data, callback) {
    if (data % 2)
      callback(null, data * 2)
    else
      callback()
  })
  
  readStream(doubler, function (err, output) {
    it(output).deepEqual(input.filter(function (j) {
      return j % 2
    }).map(function (j) {
      return j * 2
    }))
    test.done()
  })
  
  spec(doubler).through().validateOnExit()

  writeArray(input, doubler)
  
}


