/*
 * Copyright 2005 Shinya Kasatani
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

function TestSuite() {
    this.tests = [];
    this.title = "Test Suite";
    this.modified = false;	//Samit: Enh: Support for change detection
}

TestSuite.TEST_SUITE_DIRECTORY_PREF = "testSuiteDirectory";

TestSuite.load = function() {
    return showFilePicker(window, Editor.getString("chooseTestSuite"),
                          Components.interfaces.nsIFilePicker.modeOpen,
                          TestSuite.TEST_SUITE_DIRECTORY_PREF,
                          function(fp) { return TestSuite.loadFile(fp.file); });
}

TestSuite.loadFile = function(file) {
    var suite = this.loadInputStream(FileUtils.openFileInputStream(file),file);
    suite.file = file;
    return suite;
}

TestSuite.getFullPath = function(from, to) {
	if (from.indexOf("\\") !== -1){
		var fromArray = from.split("\\");
	}
	else{
		var fromArray = from.split("/");	
	}
	if ( to.indexOf("\\") !== -1){
		var toArray = to.split("\\");
		var joiner = "\\"
	}
	else{
		var toArray = to.split("/");
		var joiner = "/"
	}
	var result = "";
	toArray.push("suit");
	var d = toArray.length - 1;
	var g = fromArray.length - 1;
	for( var c = g ; c >=0 ;c--){
		if (fromArray[c] == toArray[d] && fromArray[c-1] == ".." ) {
			for (var e = 0; e < d ; e++){
				result += toArray[e] + joiner
			}
			for (var f = c ; f <= fromArray.length - 1 ; f++){
				result += fromArray[f] + joiner
			}
			break;
		}
		d--	
	}
	return result;
}


TestSuite.loadInputStream = function(input,file) {
    var content = FileUtils.getUnicodeConverter("UTF-8").ConvertToUnicode(input.read(input.available()));
    input.close();
    if (/(<table[\s>][\s\S]*?<\/table>)/i.test(content)) {
        var suite = new TestSuite();
        var tableContent = RegExp.$1;
        var pattern = /<tr[\s>][\s\S]*?<\/tr>/i;
        var linkPattern = /<a\s[^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]+)<\/a>/i;
		var suitPattern = /<a\s[^>]*isSuit=true\s[^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]+)<\/a>/i;
        var rest = tableContent;
        var r;
        while ((r = pattern.exec(rest)) != null) {
            var row = r[0];
			if (suitPattern.test(row)){
				var file_address = row.split("href=\"")[1].split("\"")[0]
				if (file_address.indexOf("\\") !== -1){
					var inner_suit_name = file_address.split("\\suit")[0].split("\\")
					}
				else {
					var inner_suit_name = file_address.split("/suit")[0].split("/")
				}
				inner_suit_name = inner_suit_name[inner_suit_name.length-1]
				file_address = this.getFullPath(file_address , file.parent.path);
				var innerSuit = this.loadFile(FileUtils.getFile(file_address));
				for( var i = 0; i < innerSuit.tests.length;i++ ) {
					innerSuit.tests[i].parent = inner_suit_name
					innerSuit.tests[i].parent_suit_address = file_address
					innerSuit.tests[i].title = innerSuit.tests[i].title + ":" + innerSuit.tests[i].parent
					suite.tests.push(innerSuit.tests[i]);
				}	
			}
            else if (linkPattern.test(row)) {
                var filename = decodeURIComponent(RegExp.$1);
                var title = RegExp.$2;
                suite.tests.push(new TestSuite.TestCase(suite, filename, title));
            }
            rest = rest.substr(r.index + row.length);
        }
        return suite;
    } else {
        throw "Failed to load test suite: <table> tag not found"
    }
}

// TODO make this configurable
TestSuite.header = 
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">\n' +
	'<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">\n' +
    "<head>\n" +
    '  <meta content="text/html; charset=UTF-8" http-equiv="content-type" />' + "\n" +
    "  <title>Test Suite</title>\n" +
    "</head>\n" +
    "<body>\n";

TestSuite.footer = 
    "</body>\n</html>\n";

TestSuite.prototype = {
    addTestCaseFromContent: function(content) {
        var testCase = new TestSuite.TestCase(this);
        testCase.content = content;
        this.tests.push(testCase);
        this.modified = true;	//Samit: Enh: Mark as changed (Issue 586)
        this.notify("testCaseAdded", testCase);
    },

    remove: function(testCase) {
        if (this.tests.length > 1) {
            if (this.tests.delete(testCase)) {
            	this.modified = true;	//Samit: Enh: Mark as changed (Issue 586)
                this.notify("testCaseRemoved", testCase);
            }
        } else {
            alert(Message("error.testCaseRemovalFailed"));
        }
    },

    move: function(fromIndex, toIndex) {
    	//Samit: Ref: Move is a fundamental part of the testSuite like add and remove and should be supported with corresponding event
        if (this.tests.length > 1) {
            var removedRow = this.tests.splice(fromIndex, 1)[0];
            this.tests.splice(toIndex, 0, removedRow);
            this.modified = true;
            this.notify("testCaseMoved", removedRow, fromIndex, toIndex);
        }
    },

    //Samit: Enh: A temp suite is a suite that is not saved and has a single test case 
    isTempSuite: function() {
    	if (this.file || this.tests.length > 1) {
			//Persisted suites and suites with more than one test cases are not temp suites
    		return false;
    	}
    	//Non-persisted suites with a single test case is a temp suite
    	return true;
    },
    
    //Samit: Enh: Provide suite modified status, contained test case modified status is not considered  
    isModified: function() {
		return this.modified;
    },

    save: function(newFile) {
        if (!this.file || newFile) {
            var self = this;
            return showFilePicker(window, Editor.getString("chooseTestSuite"),
                           Components.interfaces.nsIFilePicker.modeSave,
                           TestSuite.TEST_SUITE_DIRECTORY_PREF,
                           function(fp) {
                               self.file = fp.file;
                               return self.save(false);
                           });
        }
        var output = FileUtils.openFileOutputStream(this.file);
        var converter = FileUtils.getUnicodeConverter("UTF-8");
        var content = TestSuite.header + this.formatSuiteTable() + TestSuite.footer;
        var text = converter.ConvertFromUnicode(content);
        output.write(text, text.length);
        var fin = converter.Finish();
        if (fin.length > 0) {
            output.write(fin, fin.length);
        }
        output.close();
        this.modified = false;	//Samit: Enh: Mark as saved (Issue 586)
        return true;
    },

    formatSuiteTable: function() {
        var content = "<table id=\"suiteTable\" cellpadding=\"1\" cellspacing=\"1\" border=\"1\" class=\"selenium\"><tbody>\n";
        content += "<tr><td><b>Test Suite</b></td></tr>\n";
        for (var i = 0; i < this.tests.length; i++) {
			if (this.tests[i].parent){
			
				for ( ; i < this.tests.length; i++){
					if (!this.tests[i].parent){
						i--;
						break;
					}
				}
				content += "<tr><td><a isSuit=true href=\"" + this.tests[i].parent_suit_address + "\">" + this.tests[i].parent + "</a></td></tr>\n"
			} else {
				content += this.tests[i].format();
			}
        }
        content += "</tbody></table>\n";
        return content;
    },

  result: function() {
    var r = {
      title: "Test Suite",
      result: this.suiteResult,
      //TODO progress and baseURL and maybe real title?
      tests: []
    };
    r.tests = this.tests.map(function(test) {
      return test.result();
    });
    return r;
  },

    generateNewTestCaseTitle: function() {
        if (this.tests.some(function(test) { return /^Untitled/.test(test.getTitle()) })) {
            var max = 1;
            this.tests.forEach(function(test) {
                    if (/^Untitled (\d+)/.test(test.getTitle())) {
                        max = parseInt(RegExp.$1);
                    }
                });
            return "Untitled " + (max + 1);
        } else {
            return "Untitled";
        }
    },
    
    // return a shallow copy of testsuite
    createCopy: function() {
        var copy = new TestSuite();
        for (prop in this) {
            copy[prop] = this[prop];
        }
        return copy;
    }
}

TestSuite.TestCase = function(testSuite, filename, title) {
    this.testSuite = testSuite;
    this.filename = filename;
    this.title = title;
    this.testResult = null;
	this.parent = null;
	this.parent_suit_address = null;
}

TestSuite.TestCase.prototype = {
    getFile: function() {
        if (!this.testSuite.file) return null;
        var file = FileUtils.getFile(this.testSuite.file.parent.path);
        //alert(file + " " + this.filename);
        var filename = this.filename;
        if (Components.interfaces.nsILocalFileWin &&
            file instanceof Components.interfaces.nsILocalFileWin) {
            filename = filename.replace(/\//g, '\\');
        }
        
        try {
		file.appendRelativePath(filename);
		return file;
	}catch (e) {
            
		if (e.name && e.name == "NS_ERROR_FILE_UNRECOGNIZED_PATH") {
			//Samit: Fix: workaround security exception due to ".." in path using our own version
			return FileUtils.appendRelativePath(file, filename);
		}
	}
        return null;
     },

    getRelativeFilePath: function() {
        if (this.content) {
            return this._computeRelativePath(this.testSuite.file, this.content.file);
        } else {
            return this.filename;
        }
    },

    _computeRelativePath: function(fromFile, toFile) {
        var from = FileUtils.splitPath(fromFile.parent);
        var to = FileUtils.splitPath(toFile);
        var result = [];
        for (var base = 0; base < from.length && base < to.length; base++) {
            if (from[base] != to[base]) {
                break;
            }
        }
        for (var i = from.length - 1; i >= base; i--) {
            result.push("..");
        }
        for (var i = base; i < to.length; i++) {
            result.push(to[i]);
        }
        return result.join("/");
    },

    getFilePath: function() {
        if (this.content) {
            return this.content.filename;
        } else {
            return this.filename;
        }
    },

    setTitle: function(title) {
        if (this.content) {
            this.content.title = title;
        } else {
            this.title = title;
        }
    },

    getTitle: function() {
        if (this.content) {
            return this.content.getTitle();
        } else {
            return this.title;
        }
    },
    
    format: function() {
        return "<tr><td><a href=\"" + this.getRelativeFilePath() + "\">" +
            this.getTitle() + "</a></td></tr>\n";
    },

  result: function() {
    var r = {
      title: this.getTitle(),
      result: this.testResult,
      commands: []
    };
    if (this.content) {
      r.baseURL = this.content.baseURL;
      r.commands = this.content.commands.map(function(cmd) {
        if (cmd.type == 'comment') {
          return { type: cmd.type, comment: cmd.comment };
        } else if (cmd.type == 'command') {
          return { type: cmd.type, command: cmd.command, target: cmd.target, value: cmd.value, result: cmd.result, error: cmd.failureMessage };
        }
        return { type: cmd.type };
      });
    }
    return r;
  }

};

observable(TestSuite);
