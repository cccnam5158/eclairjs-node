/*
 * Copyright 2015 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var assert = require('assert');
var expect = require('chai').expect;

var spark = require('./lib/spark.js');
var sc = new spark.SparkContext("local[*]", "foo");
var sqlContext = new spark.SQLContext(sc);

var testOutput = [];
var listenerAdded = false;

function listener(msg) {
  testOutput.push(msg.code);
}

describe('DataFrame', function() {
  var rdd, df;

  before(function() {
    var protocol = require('../lib/kernel.js');
    protocol.resetVariables();
  });

  function onceDone(obj) {
    return new Promise(function(resolve, reject) {
      if (obj.kernelP && obj.refIdP) {
        Promise.all([obj.kernelP, obj.refIdP]).then(resolve).catch(reject);
      } else if (typeof obj.then == "function") {
        obj.then(resolve).catch(reject);
      }
    });
  }

  function executeTest(run, checks, done) {
    // called once the test is complete
    function callback() {
      try {
        checks(testOutput.length == 1 ? testOutput[0] : testOutput);
        done();
      } catch (e) {
        done(e);
      }
    }

    sc.kernel.then(function(kernel) {
      if (!listenerAdded) {
        listenerAdded = true;
        kernel.addExecuteListener(listener);
      }

      // clear the output
      testOutput = [];

      run(callback);
    });
  }

  describe("textFile", function() {
    it("should generate the correct output", function(done) {
      executeTest(
        function(callback) {
          rdd = sc.textFile("/tmp/examples/dream.txt");

          var people = rdd.map(function(line) {
            var parts = line.split(",");
            return person = {
              name: parts[0],
              age: parseInt(parts[1].trim()),
              expense: parseInt(parts[2].trim())
            };
          });

          var DataTypes = sqlContext.types.DataTypes;

          var fields = [];
          fields.push(DataTypes.createStructField("name", DataTypes.StringType, true));
          fields.push(DataTypes.createStructField("age", DataTypes.IntegerType, true));
          fields.push(DataTypes.createStructField("expense", DataTypes.IntegerType, true));

          var schema = DataTypes.createStructType(fields);

          // Convert records of the RDD (people) to Rows.
          var rowRDD = people.map(function(person){
            return RowFactory.create([person.name, person.age, person.expense]);
          });

          //Apply the schema to the RDD.
          df = sqlContext.createDataFrame(rowRDD, schema);
          onceDone(df).then(callback);
        }, function(result) {
          expect(result.length).equals(8);
        },
        done
      );
    });
  });

  describe("agg()", function() {
    it("should generate the correct output", function(done) {
      executeTest(
        function(callback) {
          var m = {};
          m["age"] = "max";
          m["expense"] = "sum";

          onceDone(df.agg(m)).then(callback);
        }, function(result) {
          expect(result).equals('var dataFrame2 = dataFrame1.agg({"age":"max","expense":"sum"});');
        },
        done
      );
    });
  });

  describe("cache()", function() {
    it("should generate the correct output", function(done) {
      executeTest(
        function(callback) {
          onceDone(df.cache()).then(callback);
        }, function(result) {
          expect(result).equals('var dataFrame3 = dataFrame1.cache();');
        },
        done
      );
    });
  });

  describe("col()", function() {
    it("should generate the correct output", function(done) {
      executeTest(
        function(callback) {
          onceDone(df.col("age")).then(callback);
        }, function(result) {
          expect(result).equals('var column1 = dataFrame1.col("age");');
        },
        done
      );
    });
  });

  describe("columns()", function() {
    it("should generate the correct output", function(done) {
      executeTest(
        function(callback) {
          onceDone(df.columns()).then(callback);
        }, function(result) {
          expect(result).equals('JSON.stringify(dataFrame1.columns());');
        },
        done
      );
    });
  });

  describe("count()", function() {
    it("should generate the correct output", function(done) {
      executeTest(
        function(callback) {
          onceDone(df.count()).then(callback);
        }, function(result) {
          expect(result).equals('dataFrame1.count();');
        },
        done
      );
    });
  });

  describe("filter(string)", function() {
    it("should generate the correct output", function(done) {
      executeTest(
        function(callback) {
          onceDone(df.filter("age > 20")).then(callback);
        }, function(result) {
          expect(result).equals('var dataFrame4 = dataFrame1.filter("age > 20");');
        },
        done
      );
    });
  });

  describe("filter(column)", function() {
    it("should generate the correct output", function(done) {
      executeTest(
        function(callback) {
          var col = df.col("age");
          var testCol = col.gt("20");
          onceDone(df.filter(testCol)).then(callback);
        }, function(result) {
          expect(result[0]).equals('var column2 = dataFrame1.col("age");');
          expect(result[1]).equals('var column3 = column2.gt("20");');
          expect(result[2]).equals('var dataFrame5 = dataFrame1.filter(column3);');
        },
        done
      );
    });
  });

  describe("flatMap", function() {
    it("should generate the correct output", function(done) {
      executeTest(
        function(callback) {
          var result = df.flatMap(function(row) {
            var r = [];
            r.push(row.getString(0));
            return r
          });

          onceDone(result).then(callback);
        }, function(result) {
          expect(result).equals('var rdd4 = dataFrame1.flatMap(function (row) {\n            var r = [];\n            r.push(row.getString(0));\n            return r\n          });');
        },
        done
      );
    });
  });

  describe("flatMap", function() {
    it("should generate the correct output", function(done) {
      executeTest(
        function(callback) {
          var result = df.flatMap(function(row) {
            var r = [];
            r.push(row.getString(0));
            return r
          });

          onceDone(result).then(callback);
        }, function(result) {
          expect(result).equals('var rdd5 = dataFrame1.flatMap(function (row) {\n            var r = [];\n            r.push(row.getString(0));\n            return r\n          });');
        },
        done
      );
    });
  });

  describe("groupBy(column)", function() {
    it("should generate the correct output", function(done) {
      executeTest(
        function(callback) {
          var result = df.groupBy(df.col("name"));

          onceDone(result).then(callback);
        }, function(result) {
          expect(result[0]).equals('var column4 = dataFrame1.col("name");');
          expect(result[1]).equals('var groupedData1 = dataFrame1.groupBy(column4);');
        },
        done
      );
    });
  });

  describe("groupBy(columnName)", function() {
    it("should generate the correct output", function(done) {
      executeTest(
        function(callback) {
          var result = df.groupBy("name");

          onceDone(result).then(callback);
        }, function(result) {
          expect(result).equals('var groupedData2 = dataFrame1.groupBy("name");');
        },
        done
      );
    });
  });

  describe("head", function() {
    it("should generate the correct output", function(done) {
      executeTest(
        function(callback) {
          var result = df.head();

          onceDone(result).then(callback);
        }, function(result) {
          expect(result).equals('var row1 = dataFrame1.head();');
        },
        done
      );
    });
  });

  describe("map", function() {
    it("should generate the correct output", function(done) {
      executeTest(
        function(callback) {
          var result = df.map(function(row) {
            return "Name: " + row.getString(0);
          });

          onceDone(result).then(callback);
        }, function(result) {
          expect(result).equals('var rdd6 = dataFrame1.map(function (row) {\n            return "Name: " + row.getString(0);\n          });');
        },
        done
      );
    });
  });

  describe("registerTempTable", function() {
    it("should generate the correct output", function(done) {
      executeTest(
        function(callback) {
          var result = df.registerTempTable("test");

          onceDone(result).then(callback);
        }, function(result) {
          expect(result).equals('dataFrame1.registerTempTable("test");');
        },
        done
      );
    });
  });

  describe("select(columnName)", function() {
    it("should generate the correct output", function(done) {
      executeTest(
        function(callback) {
          var result = df.select("name", "age");

          onceDone(result).then(callback);
        }, function(result) {
          expect(result).equals('var dataFrame6 = dataFrame1.select("name","age");');
        },
        done
      );
    });
  });

  describe("select(column)", function() {
    it("should generate the correct output", function(done) {
      executeTest(
        function(callback) {
          var result = df.select(df.col("name"), df.col("age"));

          onceDone(result).then(callback);
        }, function(result) {
          expect(result[0]).equals('var column5 = dataFrame1.col("name");');
          expect(result[1]).equals('var column6 = dataFrame1.col("age");');
          expect(result[2]).equals('var dataFrame7 = dataFrame1.select(column5,column6);');
        },
        done
      );
    });
  });

  describe("take", function() {
    it("should generate the correct output", function(done) {
      executeTest(
        function(callback) {
          var result = df.take(10);

          onceDone(result).then(callback);
        }, function(result) {
          expect(result).equals('JSON.stringify(dataFrame1.take(10));');
        },
        done
      );
    });
  });

  describe("toRDD", function() {
    it("should generate the correct output", function(done) {
      executeTest(
        function(callback) {
          var result = df.toRDD();

          onceDone(result).then(callback);
        }, function(result) {
          expect(result).equals('var rdd7 = dataFrame1.toRDD();');
        },
        done
      );
    });
  });

  describe("where(sql)", function() {
    it("should generate the correct output", function(done) {
      executeTest(
        function(callback) {
          var result = df.where("age > 20");

          onceDone(result).then(callback);
        }, function(result) {
          expect(result).equals('var dataFrame8 = dataFrame1.where("age > 20");');
        },
        done
      );
    });
  });

  describe("where(column)", function() {
    it("should generate the correct output", function(done) {
      executeTest(
        function(callback) {
          var result = df.where(df.col("age").gt("20"));

          onceDone(result).then(callback);
        }, function(result) {
          expect(result[0]).equals('var column7 = dataFrame1.col("age");');
          expect(result[1]).equals('var column8 = column7.gt("20");');
          expect(result[2]).equals('var dataFrame9 = dataFrame1.where(column8);');
        },
        done
      );
    });
  });

  describe("as()", function() {
    it("should generate the correct output", function(done) {
      executeTest(
        function(callback) {
          var result = df.as("alias");

          onceDone(result).then(callback);
        }, function(result) {
          expect(result).equals('var dataFrame10 = dataFrame1.as("alias");');
        },
        done
      );
    });
  });

  describe("apply()", function() {
    it("should generate the correct output", function(done) {
      executeTest(
        function(callback) {
          var result = df.apply("name");

          onceDone(result).then(callback);
        }, function(result) {
          expect(result).equals('var column9 = dataFrame1.apply("name");');
        },
        done
      );
    });
  });

  describe("coalesce()", function() {
    it("should generate the correct output", function(done) {
      executeTest(
        function(callback) {
          var result = df.coalesce(5);

          onceDone(result).then(callback);
        }, function(result) {
          expect(result).equals('var dataFrame11 = dataFrame1.coalesce(5);');
        },
        done
      );
    });
  });

  describe("collect()", function() {
    it("should generate the correct output", function(done) {
      executeTest(
        function(callback) {
          var result = df.collect();

          onceDone(result).then(callback);
        }, function(result) {
          expect(result).equals('JSON.stringify(dataFrame1.collect());');
        },
        done
      );
    });
  });

  describe("cube()", function() {
    it("should generate the correct output", function(done) {
      executeTest(
        function(callback) {
          var result = df.cube("name", "expense");

          onceDone(result).then(callback);
        }, function(result) {
          expect(result).equals('var groupedData3 = dataFrame1.cube("name","expense");');
        },
        done
      );
    })
  });

  describe("describe()", function() {
    it("should generate the correct output", function(done) {
      executeTest(
        function(callback) {
          var result = df.describe("name", "expense");

          onceDone(result).then(callback);
        }, function(result) {
          expect(result).equals('var dataFrame12 = dataFrame1.describe("name","expense");');
        },
        done
      );
    });
  });

  describe("drop()", function() {
    it("should generate the correct output", function(done) {
      executeTest(
        function(callback) {
          var result = df.drop("name");

          onceDone(result).then(callback);
        }, function(result) {
          expect(result).equals('var dataFrame13 = dataFrame1.drop("name");');
        },
        done
      );
    });
  });

  describe("distinct()", function() {
    it("should generate the correct output", function(done) {
      executeTest(
        function(callback) {
          var result = df.distinct();

          onceDone(result).then(callback);
        }, function(result) {
          expect(result).equals('var dataFrame14 = dataFrame1.distinct();');
        },
        done
      );
    });
  });

  describe("dropDuplicates()", function() {
    it("should generate the correct output", function(done) {
      executeTest(
        function(callback) {
          var result = df.dropDuplicates(["name"]);

          onceDone(result).then(callback);
        }, function(result) {
          expect(result).equals('var dataFrame15 = dataFrame1.dropDuplicates(["name"]);');
        },
        done
      );
    });
  });

  describe("dtypes()", function() {
    it("should generate the correct output", function(done) {
      executeTest(
        function(callback) {
          df.dtypes().then(callback);
        }, function(result) {
          expect(result).equals('JSON.stringify(dataFrame1.dtypes());');
        },
        done
      );
    });
  });
});