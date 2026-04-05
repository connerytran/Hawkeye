

from utils.validators import _is_valid_foldername

class TestValidFoldername: 

    def test_valid_foldername_accepts_simple(self):
        assert _is_valid_foldername("valid_folder") == True

    def test_valid_foldername_rejects_forward_slash(self):
        assert _is_valid_foldername("invalid/folder") == False

    def test_valid_foldername_rejects_backslash(self):
        assert _is_valid_foldername("invalid\\folder") == False

    def test_valid_foldername_rejects_colon(self):
        assert _is_valid_foldername("invalid:folder") == False

    def test_valid_foldername_rejects_star(self):
        assert _is_valid_foldername("invalid*folder") == False

    def test_valid_foldername_rejects_question_mark(self):
        assert _is_valid_foldername("invalid?folder") == False

    def test_valid_foldername_rejects_quote(self):
        assert _is_valid_foldername("invalid\"folder") == False

    def test_valid_foldername_rejects_less_than(self):
        assert _is_valid_foldername("invalid<folder") == False

    def test_valid_foldername_rejects_greater_than(self):
        assert _is_valid_foldername("invalid>folder") == False

    def test_valid_foldername_rejects_pipe(self):
        assert _is_valid_foldername("invalid|folder") == False

    def test_valid_foldername_rejects_trailing_space(self):
        assert _is_valid_foldername("invalid_folder ") == False

    def test_valid_foldername_rejects_trailing_dot(self):
        assert _is_valid_foldername("invalid_folder.") == False


